import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Nango, type ProxyConfiguration } from '@nangohq/node';

@Injectable()
export class NangoService {
  readonly client: Nango;

  constructor(config: ConfigService) {
    this.client = new Nango({
      secretKey: config.getOrThrow<string>('NANGO_SECRET_KEY'),
      host: config.get<string>('NANGO_HOST'),
    });
  }

  async createConnectSession(
    userId: string,
    organizationId: string,
    allowedIntegrations?: string[],
  ): Promise<string> {
    const { data } = await this.client.createConnectSession({
      end_user: { id: userId },
      organization: { id: organizationId },
      allowed_integrations: allowedIntegrations,
    });
    return data.token;
  }

  proxy<T = unknown>(args: ProxyConfiguration): Promise<{ data: T }> {
    return this.client.proxy<T>(args) as Promise<{ data: T }>;
  }

  getConnection(
    integrationId: string,
    connectionId: string,
  ): ReturnType<Nango['getConnection']> {
    return this.client.getConnection(integrationId, connectionId);
  }

  async deleteConnection(
    integrationId: string,
    connectionId: string,
  ): Promise<void> {
    await (this.client.deleteConnection(
      integrationId,
      connectionId,
    ) as unknown as Promise<unknown>);
  }
}
