import {
  Injectable,
  Logger,
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApolloIntegrationRepository } from './apollo-integration.repository';
import { NangoService } from '../../nango/nango.service';

export interface ApolloApiUsageStat {
  duration: 'minute' | 'hour' | 'day';
  calls_made: number;
  calls_limit: number;
}

export interface ApolloApiUsageStats {
  api_rate_limit_params: ApolloApiUsageStat[];
}

export interface ApolloConnectionStatus {
  connected: boolean;
  connectedAt?: Date;
  connectedByEmail?: string;
}

const APOLLO_PROVIDER = 'apollo-oauth';

/**
 * Shape of the ownership metadata Nango attaches to connections created
 * through connect sessions. The SDK's return type doesn't expose
 * `end_user`, but the API includes it — see POST /connect/sessions.
 */
interface NangoConnectionWithEndUser {
  end_user?: {
    id?: string;
    organization?: { id?: string };
  };
}

@Injectable()
export class ApolloIntegrationService {
  private readonly logger = new Logger(ApolloIntegrationService.name);

  constructor(
    private readonly repo: ApolloIntegrationRepository,
    private readonly nangoService: NangoService,
  ) {}

  async recordConnection(
    organizationId: number,
    userId: number,
    nangoConnectionId: string,
  ): Promise<void> {
    // Nango generates connection IDs server-side (connect sessions no
    // longer accept caller-chosen IDs), so ownership can't be inferred
    // from the ID itself. Instead, fetch the connection and verify the
    // organisation recorded on the connect session matches — otherwise
    // a user could attach another org's Apollo credentials to their
    // own org by replaying a foreign connection ID.
    let connection: NangoConnectionWithEndUser;
    try {
      connection = (await this.nangoService.getConnection(
        APOLLO_PROVIDER,
        nangoConnectionId,
      )) as NangoConnectionWithEndUser;
    } catch (err) {
      this.logger.warn(
        `Nango connection verification failed for organizationId=${organizationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new BadGatewayException(
        'Could not verify Apollo connection with Nango',
      );
    }

    // Fail closed: no end-user org on the connection means we cannot
    // prove ownership.
    const connectionOrgId = connection.end_user?.organization?.id;
    if (connectionOrgId !== String(organizationId)) {
      this.logger.warn(
        `Apollo connection ownership mismatch: organizationId=${organizationId}, connection end_user org=${connectionOrgId ?? 'missing'}`,
      );
      throw new ForbiddenException(
        'Connection does not belong to this organisation',
      );
    }

    await this.repo.upsert(organizationId, userId, nangoConnectionId);
    this.logger.log(
      `Apollo connection recorded for organizationId=${organizationId}`,
    );
  }

  async getConnectionStatus(
    organizationId: number,
  ): Promise<ApolloConnectionStatus> {
    const record = await this.repo.findByOrganizationId(organizationId);
    if (!record) return { connected: false };

    return {
      connected: true,
      connectedAt: record.connectedAt,
      connectedByEmail: record.connectedBy.email,
    };
  }

  async getUsageStats(organizationId: number): Promise<ApolloApiUsageStats> {
    const record = await this.repo.findByOrganizationId(organizationId);
    if (!record?.nangoConnectionId) {
      throw new NotFoundException(
        'Apollo is not connected for this organisation.',
      );
    }
    const nangoConnectionId = record.nangoConnectionId;

    let response: { data: ApolloApiUsageStats };
    try {
      // Apollo "View API Usage Stats" endpoint:
      // https://docs.apollo.io/reference/get-api-usage-stats
      // (POST /api/v1/usage_stats/api_usage_stats, empty body).
      // Proxied through Nango so the access token never leaves the
      // backend; `retries` lets Nango absorb transient 5xx/429s.
      response = await this.nangoService.proxy<ApolloApiUsageStats>({
        method: 'POST',
        endpoint: '/api/v1/usage_stats/api_usage_stats',
        providerConfigKey: APOLLO_PROVIDER,
        connectionId: nangoConnectionId,
        retries: 3,
      });
    } catch (err) {
      this.logger.warn(
        `Apollo usage stats proxy call failed for organizationId=${organizationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new BadGatewayException('Failed to fetch Apollo API usage stats');
    }

    if (!response.data) {
      throw new BadGatewayException('Failed to fetch Apollo API usage stats');
    }

    return response.data;
  }

  async disconnect(organizationId: number): Promise<void> {
    const record = await this.repo.findByOrganizationId(organizationId);
    if (!record) return;

    if (record.nangoConnectionId) {
      try {
        await this.nangoService.deleteConnection(
          APOLLO_PROVIDER,
          record.nangoConnectionId,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to delete Nango connection for organizationId=${organizationId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    await this.repo.delete(organizationId);
    this.logger.log(`Apollo disconnected for organizationId=${organizationId}`);
  }

  async getAccessToken(organizationId: number): Promise<string> {
    const record = await this.repo.findByOrganizationId(organizationId);
    if (!record?.nangoConnectionId) {
      throw new NotFoundException(
        'Apollo is not connected for this organisation.',
      );
    }
    const nangoConnectionId = record.nangoConnectionId;

    let connection: Awaited<
      ReturnType<NangoService['getConnection']>
    > | null = null;
    try {
      connection = await this.nangoService.getConnection(
        APOLLO_PROVIDER,
        nangoConnectionId,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Nango connection for organizationId=${organizationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    if (!connection) {
      throw new NotFoundException(
        'Apollo is not connected for this organisation.',
      );
    }

    const creds = connection.credentials as { access_token?: unknown };
    if (typeof creds?.access_token !== 'string' || !creds.access_token) {
      this.logger.error(
        `Nango returned credentials without an access_token for organizationId=${organizationId}`,
      );
      throw new BadGatewayException(
        'Apollo credentials are missing an access token',
      );
    }
    return creds.access_token;
  }
}
