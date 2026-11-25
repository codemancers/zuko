import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import axios from 'axios';
import { createHash, randomBytes } from 'node:crypto';
import type { User } from './crm-client';

const HOST = process.env.HOST ?? 'localhost';
const PORT = process.env.PORT ?? '3000';
export const BASE = `http://${HOST}:${PORT}`;
export const MCP_URL = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/eve/v1/mcp`;
export const MCP_METADATA_URL = new URL('/.well-known/oauth-protected-resource/eve/v1/mcp', MCP_URL)
  .href;
export const REDIRECT_URI = 'http://localhost:9999/callback';

export interface Connection {
  clientId: string;
  accessToken: string;
  refreshToken: string;
  scope: string;
  claims: Record<string, unknown>;
}

const decode = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

/** Register a client the way a desktop MCP client does. */
export async function registerClient(
  name: string,
  scope: string,
  overrides: Record<string, unknown> = {},
) {
  return axios.post(
    `${BASE}/auth/oauth2/register`,
    {
      client_name: name,
      application_type: 'native',
      redirect_uris: [REDIRECT_URI],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope,
      ...overrides,
    },
    { validateStatus: () => true },
  );
}

/**
 * What connecting an MCP client involves: register, authorize with PKCE, accept consent
 * (the frontend consent page does exactly this call), and exchange the code for tokens.
 * The user's session decides who the connection is for and which organization it binds to.
 */
export async function connect(
  user: User,
  name: string,
  scope: string,
  existingClientId?: string,
): Promise<Connection> {
  let clientId = existingClientId;
  if (!clientId) {
    const registered = await registerClient(name, scope);
    if (registered.status !== 201) {
      throw new Error(`registration failed: ${JSON.stringify(registered.data)}`);
    }
    clientId = registered.data.client_id as string;
  }

  const verifier = randomBytes(32).toString('base64url');
  const authorize = await user.get(
    `/auth/oauth2/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      scope,
      state: 'state-1',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      resource: MCP_URL,
    })}`,
  );
  const consentUrl = new URL(authorize.data.url);
  if (!consentUrl.pathname.endsWith('/consent')) {
    throw new Error(`expected the consent page, got ${authorize.data.url}`);
  }

  const consent = await user.post('/auth/oauth2/consent', {
    accept: true,
    oauth_query: consentUrl.search.slice(1),
  });
  const code = new URL(consent.data.url).searchParams.get('code');
  if (!code) {
    throw new Error(`consent did not return a code: ${JSON.stringify(consent.data)}`);
  }

  const token = await user.form('/auth/oauth2/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: verifier,
    resource: MCP_URL,
  });
  if (token.status !== 200) {
    throw new Error(`token exchange failed: ${JSON.stringify(token.data)}`);
  }
  return {
    clientId,
    accessToken: token.data.access_token,
    refreshToken: token.data.refresh_token,
    scope: token.data.scope,
    claims: decode(token.data.access_token),
  };
}

export type ToolOutput = { isError: boolean; data: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** An MCP session over the official client, authenticated with an access token. */
export async function openSession(accessToken: string) {
  const client = new Client({ name: 'e2e-client', version: '1.0.0' });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(MCP_URL), {
      requestInit: { headers: { Authorization: `Bearer ${accessToken}` } },
    }),
  );
  return {
    client,
    tools: async () => (await client.listTools()).tools,
    /** Call a tool and parse its JSON text result. */
    call: async (name: string, args: Record<string, unknown> = {}): Promise<ToolOutput> => {
      const result = await client.callTool({ name, arguments: args });
      const text = (result.content as { type: string; text: string }[])[0]?.text ?? 'null';
      return {
        isError: result.isError === true,
        data:
          result.isError &&
          result.structuredContent &&
          typeof result.structuredContent === 'object' &&
          'error' in result.structuredContent
            ? result.structuredContent
            : JSON.parse(text),
      };
    },
    close: () => client.close(),
  };
}

/** The user turns an application down on the consent page. Returns the client's id. */
export async function deny(user: User, name: string, scope: string): Promise<string> {
  const registered = await registerClient(name, scope);
  const clientId: string = registered.data.client_id;
  const authorize = await user.get(
    `/auth/oauth2/authorize?${new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      scope,
      state: 'state-1',
      code_challenge: createHash('sha256')
        .update(randomBytes(32).toString('base64url'))
        .digest('base64url'),
      code_challenge_method: 'S256',
      resource: MCP_URL,
    })}`,
  );
  const consent = await user.post('/auth/oauth2/consent', {
    accept: false,
    oauth_query: new URL(authorize.data.url).search.slice(1),
  });
  if (!new URL(consent.data.url).searchParams.get('error')) {
    throw new Error(`expected a refusal, got ${JSON.stringify(consent.data)}`);
  }
  return clientId;
}
