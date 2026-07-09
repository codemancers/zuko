import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Nango, type ProxyConfiguration } from '@nangohq/node';

@Injectable()
export class NangoService {
  private lazyClient: Nango | null = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * NANGO_SECRET_KEY is optional (see env.validation.ts): environments
   * without Nango configured (e.g. CI e2e) must still be able to boot
   * the backend. Constructing the client eagerly in the constructor
   * would crash Nest bootstrap when the key is absent, so we defer to
   * first use and return 503 for Nango-backed endpoints instead.
   */
  private get client(): Nango {
    if (!this.lazyClient) {
      const secretKey = this.config.get<string>('NANGO_SECRET_KEY');
      if (!secretKey) {
        throw new ServiceUnavailableException(
          'Nango is not configured (NANGO_SECRET_KEY is missing)',
        );
      }
      this.lazyClient = new Nango({
        secretKey,
        host: this.config.get<string>('NANGO_HOST'),
      });
    }
    return this.lazyClient;
  }

  async createConnectSession(
    userId: string,
    organizationId: string,
    // Required on purpose: callers must pass a server-side constant,
    // never client input.
    allowedIntegrations: string[],
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
