import { toolScopes } from './scopes';
import { verifyBearerToken } from 'better-auth/oauth2';
import { extractBearerToken, ForbiddenError, type AuthFn } from 'eve/channels/auth';
import {
  backendUrl,
  frontendUrl,
  issuer,
  mcpResource,
  grantClaim,
  orgClaim,
  serviceHeaders,
} from './backend';
import { requestFileProblems } from './chat-request';
import { readMcpRequest } from './mcp-request';

/** Only grant references enter durable session attributes; incoming bearer tokens do not. */
export const zukoAuth =
  (browser: boolean): AuthFn<Request> =>
  async (request) => {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) return null;
    const resource = browser ? `${frontendUrl}/eve` : mcpResource;
    let claims;
    try {
      claims = await verifyBearerToken(token, {
        jwksUrl: `${backendUrl}/auth/jwks`,
        verifyOptions: { issuer, audience: resource, algorithms: ['EdDSA', 'ES256', 'RS256'] },
      });
    } catch (error) {
      const failure = error as { status?: string; body?: { error?: string } };
      if (failure.status === 'UNAUTHORIZED' && failure.body?.error === 'invalid_token') return null;
      throw error;
    }
    const userId = claims.sub;
    const organizationId = claims[orgClaim];
    const reference = claims[grantClaim];
    if (
      typeof userId !== 'string' ||
      !/^[1-9]\d*$/.test(userId) ||
      typeof organizationId !== 'string' ||
      !/^[1-9]\d*$/.test(organizationId) ||
      typeof reference !== 'string' ||
      !reference
    )
      return null;
    const scopes =
      typeof claims.scope === 'string' ? claims.scope.split(/\s+/).filter(Boolean) : [];
    if (browser && request.method === 'POST') {
      // File bytes never travel in a message; refuse inline content with a reason (see chat-request.ts).
      const problems = await requestFileProblems(request);
      if (problems.length > 0)
        throw new ForbiddenError({ code: 'inline_file_refused', message: problems.join('; ') });
    }
    if (!browser && request.method === 'POST') {
      const body = await readMcpRequest(request);
      if (body?.method === 'tools/call' && typeof body.params?.name === 'string') {
        const name = body.params.name;
        const required = name.startsWith('agent_')
          ? 'agent:invoke'
          : Object.hasOwn(toolScopes, name)
            ? toolScopes[name]
            : undefined;
        if (!required)
          throw new ForbiddenError({
            code: 'unscoped_tool',
            message: 'This tool has no declared OAuth scope',
          });
        if (!scopes.includes(required)) {
          throw new ForbiddenError({
            message: `${required} is required`,
            challenges: [
              { scheme: 'Bearer', parameters: { error: 'insufficient_scope', scope: required } },
            ],
          });
        }
        // Starting work spends model budget. Check live access before enqueuing it.
        if (name === 'agent_start' || name === 'agent_update') {
          const access = await fetch(`${backendUrl}/api/v1/harness/delegate`, {
            method: 'POST',
            headers: serviceHeaders(),
            body: JSON.stringify({ reference, organization_id: organizationId }),
            signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
          });
          if ([401, 403, 409].includes(access.status))
            throw new ForbiddenError({
              message: 'This connection no longer has organization access',
            });
          if (!access.ok) throw new Error(`Zuko authorization unavailable (${access.status})`);
          await access.body?.cancel();
        }
      }
    }
    return {
      authenticator: 'zuko',
      issuer,
      principalType: 'user',
      subject: userId,
      // A different organization or grant cannot read or continue an existing invocation.
      principalId: `user:${userId}:organization:${organizationId}:grant:${reference}`,
      attributes: {
        [grantClaim]: reference,
        [orgClaim]: organizationId,
      },
    };
  };
