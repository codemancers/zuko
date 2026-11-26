import { toolOutput, type ToolContext } from 'eve/tools';

export const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
export const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
export const issuer = `${backendUrl}/auth`;
export const mcpResource = `${frontendUrl}/eve/v1/mcp`;
export const grantClaim = 'urn:zuko:harness_grant';
export const orgClaim = 'urn:zuko:org_id';

export function serviceHeaders() {
  const key = process.env.EVE_AUTH_SECRET?.trim();
  if (!key || Buffer.byteLength(key) < 32)
    throw new Error('EVE_AUTH_SECRET must be at least 32 bytes');
  return { 'content-type': 'application/json', 'x-zuko-harness-key': key };
}

const delegationCache = new Map<string, { token: string; until: number }>();
const upstreamError = (status: number, service: string) => ({
  zuko_error: {
    code: 'UPSTREAM_ERROR',
    message: `${service} returned an invalid response (${status})`,
    status,
  },
});

async function readResponse(response: Response, service: string) {
  if (response.status === 204 && response.ok) return null;
  try {
    return await response.json();
  } catch {
    return upstreamError(response.status, service);
  }
}

export async function crmRequest(ctx: ToolContext, method: string, path: string, body?: unknown) {
  ctx.abortSignal.throwIfAborted();
  const caller = ctx.session.auth.current;
  if (caller?.principalType !== 'user') throw new Error('A signed-in user is required');
  const reference = caller.attributes[grantClaim];
  const organization_id = caller.attributes[orgClaim];
  if (typeof reference !== 'string' || typeof organization_id !== 'string')
    throw new Error('Reconnect to Zuko to authorize this session');
  const key = JSON.stringify([organization_id, reference]);
  const cached = delegationCache.get(key);
  let accessToken = cached && cached.until > Date.now() ? cached.token : undefined;
  if (!accessToken) {
    delegationCache.delete(key);
    const delegated = await fetch(`${backendUrl}/api/v1/harness/delegate`, {
      method: 'POST',
      headers: serviceHeaders(),
      body: JSON.stringify({ reference, organization_id }),
      signal: AbortSignal.any([ctx.abortSignal, AbortSignal.timeout(10_000)]),
    });
    const result = await readResponse(delegated, 'Zuko delegation');
    if (!delegated.ok)
      return {
        zuko_error: {
          code: 'DELEGATION_REFUSED',
          status: delegated.status,
          message: `Zuko delegation refused (${delegated.status}); reconnect or check your organization access`,
        },
      };
    const token = result as { access_token?: unknown; expires_at?: unknown } | null;
    if (typeof token?.access_token !== 'string' || !token.access_token)
      return upstreamError(delegated.status, 'Zuko delegation');
    accessToken = token.access_token;
    // Memory only; CRM guards recheck live access on every call, including cache hits.
    if (typeof token.expires_at === 'number' && Number.isFinite(token.expires_at)) {
      if (delegationCache.size >= 500) delegationCache.delete(delegationCache.keys().next().value!);
      delegationCache.set(key, {
        token: accessToken,
        until: Math.min(token.expires_at - 5000, Date.now() + 55_000),
      });
    }
  }
  const response = await fetch(`${backendUrl}/api/v1/${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.any([ctx.abortSignal, AbortSignal.timeout(30_000)]),
  });
  if (response.status === 401 || response.status === 403) delegationCache.delete(key);
  const result = await readResponse(response, 'CRM API');
  if (result && typeof result === 'object' && 'zuko_error' in result) return result;
  if (!response.ok) return { zuko_error: result };
  return result;
}

export const segment = (value: string) => encodeURIComponent(value);
export const recordsPath = (object: string) => `objects/${segment(object)}/records`;
export const commentsPath = (object: string, id: string) =>
  `${recordsPath(object)}/${segment(id)}/comments`;
export const query = (values: Record<string, unknown>) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined) params.set(key, String(value));
  return params.size ? `?${params}` : '';
};

export const crmOutput = (output: unknown) => {
  if (output && typeof output === 'object' && 'zuko_error' in output)
    return toolOutput.errorText(JSON.stringify(output.zuko_error));
  return toolOutput.json(output);
};
