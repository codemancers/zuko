import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createHash } from 'crypto';
import { ApolloIntegrationRepository } from './apollo-integration.repository';

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const APOLLO_SCOPES = [
  'read_user_profile',
  'contacts_search',
  'organizations_search',
  'organizations_enrich',
  'organizations_bulk_enrich',
  'credit_usage_stats_read',
].join(' ');

export interface ApolloConnectionStatus {
  connected: boolean;
  connectedAt?: Date;
  connectedByEmail?: string;
}

export interface ApolloAuthorizationUrl {
  url: string;
}

interface ApolloTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

interface OAuthStatePayload {
  codeVerifier: string;
  organizationId: number;
  userId: number;
}

@Injectable()
export class ApolloIntegrationService {
  private readonly logger = new Logger(ApolloIntegrationService.name);

  constructor(
    private readonly apolloIntegrationRepository: ApolloIntegrationRepository,
    private readonly configService: ConfigService,
  ) {}

  private clientId(): string {
    return this.configService.getOrThrow<string>('APOLLO_CLIENT_ID');
  }

  private clientSecret(): string {
    return this.configService.getOrThrow<string>('APOLLO_CLIENT_SECRET');
  }

  private redirectUri(): string {
    return this.configService.getOrThrow<string>('APOLLO_REDIRECT_URI');
  }

  private authorizationEndpoint(): string {
    return this.configService.getOrThrow<string>(
      'APOLLO_AUTHORIZATION_ENDPOINT',
    );
  }

  private tokenEndpoint(): string {
    return this.configService.getOrThrow<string>('APOLLO_TOKEN_ENDPOINT');
  }

  private revocationEndpoint(): string {
    return this.configService.getOrThrow<string>('APOLLO_REVOCATION_ENDPOINT');
  }

  private generateCodeVerifier(): string {
    return randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(codeVerifier: string): string {
    return createHash('sha256').update(codeVerifier).digest('base64url');
  }

  private generateState(): string {
    return randomBytes(32).toString('base64url');
  }

  async buildAuthorizationUrl(
    organizationId: number,
    userId: number,
  ): Promise<ApolloAuthorizationUrl> {
    const state = this.generateState();
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);

    const payload: OAuthStatePayload = { codeVerifier, organizationId, userId };
    await this.apolloIntegrationRepository.createOAuthState(
      state,
      JSON.stringify(payload),
      new Date(Date.now() + OAUTH_STATE_TTL_MS),
    );

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId(),
      redirect_uri: this.redirectUri(),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    // Apollo requires %20-encoded spaces in scope, not + from URLSearchParams
    const url = `${this.authorizationEndpoint()}?${params.toString()}&scope=${encodeURIComponent(APOLLO_SCOPES)}`;
    this.logger.log(
      `Built Apollo authorization URL for organizationId=${organizationId} userId=${userId} scopes="${APOLLO_SCOPES}"`,
    );

    return { url };
  }

  async exchangeCodeForTokens(code: string, state: string): Promise<void> {
    const verification =
      await this.apolloIntegrationRepository.findOAuthState(state);

    if (!verification) {
      throw new UnauthorizedException(
        'Invalid or expired OAuth state. Please try connecting again.',
      );
    }

    const { codeVerifier, organizationId, userId } = JSON.parse(
      verification.value,
    ) as OAuthStatePayload;

    await this.apolloIntegrationRepository.deleteOAuthState(verification.id);

    const tokenResponse = await this.fetchTokens({
      grantType: 'authorization_code',
      code,
      codeVerifier,
    });

    await this.persistTokens(organizationId, userId, tokenResponse);
    this.logger.log(
      `Apollo tokens stored for organizationId=${organizationId}`,
    );
  }

  async refreshAccessToken(organizationId: number): Promise<string> {
    const integration =
      await this.apolloIntegrationRepository.findByOrganizationId(
        organizationId,
      );

    if (!integration?.refreshToken) {
      throw new NotFoundException(
        'No Apollo connection found or refresh token unavailable.',
      );
    }

    const tokenResponse = await this.fetchTokens({
      grantType: 'refresh_token',
      refreshToken: integration.refreshToken,
    });

    await this.persistTokens(
      organizationId,
      integration.connectedById,
      tokenResponse,
    );
    this.logger.log(
      `Apollo access token refreshed for organizationId=${organizationId}`,
    );

    return tokenResponse.access_token;
  }

  async getAccessToken(organizationId: number): Promise<string> {
    const integration =
      await this.apolloIntegrationRepository.findByOrganizationId(
        organizationId,
      );

    if (!integration) {
      throw new NotFoundException(
        'Apollo is not connected for this organisation.',
      );
    }

    const isExpiringSoon =
      integration.tokenExpiresAt !== null &&
      integration.tokenExpiresAt <= new Date(Date.now() + 60_000);

    if (isExpiringSoon && integration.refreshToken) {
      return this.refreshAccessToken(organizationId);
    }

    return integration.accessToken;
  }

  async getConnectionStatus(
    organizationId: number,
  ): Promise<ApolloConnectionStatus> {
    const integration =
      await this.apolloIntegrationRepository.findByOrganizationId(
        organizationId,
      );

    if (!integration) {
      return { connected: false };
    }

    return {
      connected: true,
      connectedAt: integration.connectedAt,
      connectedByEmail: integration.connectedBy.email,
    };
  }

  async disconnect(organizationId: number): Promise<void> {
    const integration =
      await this.apolloIntegrationRepository.findByOrganizationId(
        organizationId,
      );

    if (!integration) {
      return;
    }

    try {
      await this.revokeTokenWithApollo(integration.accessToken);
    } catch (error) {
      this.logger.warn(
        `Failed to revoke Apollo token for organizationId=${organizationId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await this.apolloIntegrationRepository.delete(organizationId);
    this.logger.log(`Apollo disconnected for organizationId=${organizationId}`);
  }

  private async persistTokens(
    organizationId: number,
    userId: number,
    tokenResponse: ApolloTokenResponse,
  ): Promise<void> {
    const tokenExpiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined;

    await this.apolloIntegrationRepository.upsert(
      organizationId,
      {
        organizationId,
        connectedById: userId,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenExpiresAt,
      },
      {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenExpiresAt,
        connectedById: userId,
        connectedAt: new Date(),
      },
    );
  }

  private async fetchTokens(
    params:
      | { grantType: 'authorization_code'; code: string; codeVerifier: string }
      | { grantType: 'refresh_token'; refreshToken: string },
  ): Promise<ApolloTokenResponse> {
    const body = new URLSearchParams({ client_id: this.clientId() });

    if (params.grantType === 'authorization_code') {
      body.set('grant_type', 'authorization_code');
      body.set('code', params.code);
      body.set('redirect_uri', this.redirectUri());
      body.set('code_verifier', params.codeVerifier);
    } else {
      body.set('grant_type', 'refresh_token');
      body.set('refresh_token', params.refreshToken);
    }

    const credentials = Buffer.from(
      `${this.clientId()}:${this.clientSecret()}`,
    ).toString('base64');

    const response = await fetch(this.tokenEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `Apollo token exchange failed: ${response.status} ${errorBody}`,
      );
      throw new BadRequestException(
        'Failed to exchange code for Apollo tokens. Please try again.',
      );
    }

    return response.json() as Promise<ApolloTokenResponse>;
  }

  private async revokeTokenWithApollo(accessToken: string): Promise<void> {
    const credentials = Buffer.from(
      `${this.clientId()}:${this.clientSecret()}`,
    ).toString('base64');

    await fetch(this.revocationEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
      body: new URLSearchParams({ token: accessToken }).toString(),
    });
  }
}
