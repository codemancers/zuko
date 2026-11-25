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

export async function crmRequest(ctx: ToolContext, method: string, path: string, body?: unknown) {
  const caller = ctx.session.auth.current;
  if (caller?.principalType !== 'user') throw new Error('A signed-in user is required');
  const reference = caller.attributes[grantClaim];
  const organization_id = caller.attributes[orgClaim];
  if (typeof reference !== 'string' || typeof organization_id !== 'string')
    throw new Error('Reconnect to Zuko to authorize this session');
  const delegated = await fetch(`${backendUrl}/api/v1/harness/delegate`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ reference, organization_id }),
    signal: AbortSignal.any([ctx.abortSignal, AbortSignal.timeout(10_000)]),
  });
  if (!delegated.ok)
    throw new Error(
      `Zuko delegation refused (${delegated.status}); reconnect or check your organization access`,
    );
  const { access_token } = (await delegated.json()) as { access_token: string };
  const response = await fetch(`${backendUrl}/api/v1/${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${access_token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.any([ctx.abortSignal, AbortSignal.timeout(30_000)]),
  });
  const result = await response.json();
  if (!response.ok) return { zuko_error: result };
  return result;
}

export const segment = (value: string) => encodeURIComponent(value);
export const recordsPath = (object: string) => `objects/${segment(object)}/records`;
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
