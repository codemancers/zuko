import { toolScopes } from './scopes';
import { verifyBearerToken } from 'better-auth/oauth2';
import { extractBearerToken, ForbiddenError, type AuthFn } from 'eve/channels/auth';
import { backendUrl, frontendUrl, issuer, mcpResource, grantClaim, orgClaim } from './backend';

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
    if (!browser && request.method === 'POST') {
      const body = (await request
        .clone()
        .json()
        .catch(() => null)) as { method?: string; params?: { name?: string } } | null;
      if (body?.method === 'tools/call' && typeof body.params?.name === 'string') {
        const name = body.params.name;
        const required = name.startsWith('agent_') ? 'agent:invoke' : toolScopes[name];
        if (required && !scopes.includes(required)) {
          throw new ForbiddenError({
            message: `${required} is required`,
            challenges: [
              { scheme: 'Bearer', parameters: { error: 'insufficient_scope', scope: required } },
            ],
          });
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
