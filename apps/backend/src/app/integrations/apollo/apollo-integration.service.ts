import {
  Injectable,
  Logger,
  BadGatewayException,
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

@Injectable()
export class ApolloIntegrationService {
  private readonly logger = new Logger(ApolloIntegrationService.name);

  constructor(
    private readonly repo: ApolloIntegrationRepository,
    private readonly nangoService: NangoService,
  ) {}

  connectionId(organizationId: number): string {
    return `org-${organizationId}`;
  }

  async recordConnection(
    organizationId: number,
    userId: number,
    nangoConnectionId: string,
  ): Promise<void> {
    // Verify Nango has the connection before recording
    await this.nangoService.getConnection('apollo-oauth', nangoConnectionId);
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
    const nangoConnectionId =
      record?.nangoConnectionId ?? this.connectionId(organizationId);
    const response = await this.nangoService.proxy<ApolloApiUsageStats>({
      method: 'POST',
      endpoint: '/api/v1/usage_stats/api_usage_stats',
      providerConfigKey: 'apollo-oauth',
      connectionId: nangoConnectionId,
    });

    if (!response.data) {
      throw new BadGatewayException('Failed to fetch Apollo API usage stats');
    }

    return response.data;
  }

  async disconnect(organizationId: number): Promise<void> {
    const record = await this.repo.findByOrganizationId(organizationId);
    if (!record) return;

    const nangoConnectionId =
      record.nangoConnectionId ?? this.connectionId(organizationId);
    try {
      await this.nangoService.deleteConnection(
        'apollo-oauth',
        nangoConnectionId,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to delete Nango connection for organizationId=${organizationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    await this.repo.delete(organizationId);
    this.logger.log(`Apollo disconnected for organizationId=${organizationId}`);
  }

  async getAccessToken(organizationId: number): Promise<string> {
    const record = await this.repo.findByOrganizationId(organizationId);
    const nangoConnectionId =
      record?.nangoConnectionId ?? this.connectionId(organizationId);
    const connection = await this.nangoService.getConnection(
      'apollo-oauth',
      nangoConnectionId,
    );

    if (!connection) {
      throw new NotFoundException(
        'Apollo is not connected for this organisation.',
      );
    }

    const creds = connection.credentials as { access_token: string };
    return creds.access_token;
  }
}
