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

/** What the helpers below need of a tool or channel context: the caller's session and an optional abort signal. */
export interface CallerContext {
  readonly abortSignal?: AbortSignal;
  readonly session: {
    readonly auth?: {
      readonly current?: {
        readonly principalType?: string;
        readonly attributes: Record<string, unknown>;
      } | null;
    } | null;
  };
}

type Zuko_error = { zuko_error: { code: string; message: string; status?: number } };

/** A short-lived backend token for the signed-in caller, acting within their grant. */
async function delegate(
  ctx: CallerContext,
): Promise<{ token: string; key: string } | Zuko_error | ReturnType<typeof upstreamError>> {
  ctx.abortSignal?.throwIfAborted();
  const caller = ctx.session.auth?.current;
  if (caller?.principalType !== 'user') throw new Error('A signed-in user is required');
  const reference = caller.attributes[grantClaim];
  const organization_id = caller.attributes[orgClaim];
  if (typeof reference !== 'string' || typeof organization_id !== 'string')
    throw new Error('Reconnect to Zuko to authorize this session');
  const key = JSON.stringify([organization_id, reference]);
  const cached = delegationCache.get(key);
  if (cached && cached.until > Date.now()) return { token: cached.token, key };
  delegationCache.delete(key);
  const delegated = await fetch(`${backendUrl}/api/v1/harness/delegate`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ reference, organization_id }),
    signal: AbortSignal.any([...(ctx.abortSignal ? [ctx.abortSignal] : []), AbortSignal.timeout(10_000)]),
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
  const accessToken = token.access_token;
  // Memory only; CRM guards recheck live access on every call, including cache hits.
  if (typeof token.expires_at === 'number' && Number.isFinite(token.expires_at)) {
    if (delegationCache.size >= 500) delegationCache.delete(delegationCache.keys().next().value!);
    delegationCache.set(key, {
      token: accessToken,
      until: Math.min(token.expires_at - 5000, Date.now() + 55_000),
    });
  }
  return { token: accessToken, key };
}

/** A raw backend call as the caller. The body is sent as given (JSON text, or FormData for an upload). */
export async function backendFetch(
  ctx: CallerContext,
  path: string,
  init: { method: string; body?: string | FormData; json?: boolean; timeoutMs?: number },
): Promise<Response | Zuko_error | ReturnType<typeof upstreamError>> {
  const access = await delegate(ctx);
  if ('zuko_error' in access) return access;
  const response = await fetch(`${backendUrl}/api/v1/${path}`, {
    method: init.method,
    headers: {
      ...(init.json === false ? {} : { 'content-type': 'application/json' }),
      authorization: `Bearer ${access.token}`,
    },
    ...(init.body === undefined ? {} : { body: init.body }),
    signal: AbortSignal.any([
      ...(ctx.abortSignal ? [ctx.abortSignal] : []),
      AbortSignal.timeout(init.timeoutMs ?? 30_000),
    ]),
  });
  if (response.status === 401 || response.status === 403) delegationCache.delete(access.key);
  return response;
}

/** A JSON call to the CRM API: the parsed result, or `{ zuko_error }`. */
export async function crmRequest(ctx: ToolContext, method: string, path: string, body?: unknown) {
  const response = await backendFetch(ctx, path, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!(response instanceof Response)) return response;
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
