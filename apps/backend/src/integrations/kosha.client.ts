import { Injectable } from '@nestjs/common';
import { CrmError } from '../crm/errors';

/** One Apollo response as Kosha relayed it. */
export interface Upstream {
  status: number;
  body: unknown;
  retryAfter: string | null;
}

export interface KoshaConnection {
  id: string;
  accountId?: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}

const PROVIDER = 'apollo';
const CONFIGURATION = 'apollo';

/**
 * Talks to Kosha (apps/connect), which holds Zuko's Apollo API key encrypted and makes the Apollo calls.
 * Zuko never stores the key; it hands it over once and afterwards only names the connection by owner.
 */
@Injectable()
export class KoshaClient {
  private get base() {
    const url = process.env.KOSHA_URL?.trim();
    const key = process.env.KOSHA_API_KEY?.trim();
    if (!url || !key) {
      throw new CrmError(503, 'INTEGRATIONS_NOT_CONFIGURED', 'The connections service is not configured');
    }
    return { url: url.replace(/\/$/, ''), key };
  }

  private async send(method: string, path: string, body?: unknown): Promise<Response> {
    const { url, key } = this.base;
    try {
      return await fetch(`${url}/api${path}`, {
        method,
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new CrmError(502, 'CONNECTIONS_UNAVAILABLE', 'The connections service did not respond');
    }
  }

  private static async json(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  async find(owner: string): Promise<KoshaConnection | null> {
    const response = await this.send(
      'GET',
      `/connections?provider=${PROVIDER}&configurationSlug=${CONFIGURATION}&externalUserId=${encodeURIComponent(owner)}`,
    );
    if (!response.ok) {
      throw new CrmError(502, 'CONNECTIONS_UNAVAILABLE', `The connections service answered ${response.status}`);
    }
    const rows = (await KoshaClient.json(response)) as KoshaConnection[] | null;
    return Array.isArray(rows) && rows.length > 0 ? (rows[0] ?? null) : null;
  }

  /** Kosha checks the key with Apollo before it stores anything. */
  async connect(owner: string, apiKey: string): Promise<KoshaConnection> {
    const response = await this.send('POST', '/connect/credential', {
      externalUserId: owner,
      provider: PROVIDER,
      configurationSlug: CONFIGURATION,
      credential: { credential: apiKey },
    });
    const body = (await KoshaClient.json(response)) as { connectionId?: string; message?: string } | null;
    if (response.status === 400) {
      throw new CrmError(400, 'APOLLO_KEY_REJECTED', body?.message ?? 'Apollo did not accept that API key');
    }
    if (!response.ok || !body?.connectionId) {
      throw new CrmError(502, 'CONNECTIONS_UNAVAILABLE', `The connections service answered ${response.status}`);
    }
    return { id: body.connectionId };
  }

  async revoke(connectionId: string): Promise<void> {
    const response = await this.send('DELETE', `/connections/${PROVIDER}/${encodeURIComponent(connectionId)}`);
    if (!response.ok && response.status !== 404) {
      throw new CrmError(502, 'CONNECTIONS_UNAVAILABLE', `The connections service answered ${response.status}`);
    }
  }

  /** A request to Apollo, made with the owner's key by Kosha. `path` is Apollo's, e.g. `/people/match`. */
  async call(owner: string, method: 'GET' | 'POST', path: string, query: Record<string, string>): Promise<Upstream> {
    const search = new URLSearchParams(query).toString();
    const response = await this.send(
      method,
      `/proxy/${PROVIDER}/${CONFIGURATION}/${encodeURIComponent(owner)}${path}${search ? `?${search}` : ''}`,
      method === 'POST' ? {} : undefined,
    );
    return {
      status: response.status,
      body: await KoshaClient.json(response),
      retryAfter: response.headers.get('retry-after'),
    };
  }
}
