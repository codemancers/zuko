import { type AuthFn } from 'eve/channels/auth';
import { eveChannel } from 'eve/channels/eve';
import { verifyEvePrincipal } from '../lib/eve-principal.js';

/**
 * Trusted-header AuthFn — the SOLE authenticator. The Zuko NestJS edge
 * terminates the user's session and forwards an HMAC-signed principal in
 * `x-eve-principal`; we verify it and project it onto eve's `SessionAuthContext`.
 *
 * Returns `null` when the header is absent or invalid. With no other
 * authenticator in the walk, that yields a clean 401 — a signed principal is
 * required, with no loopback/local-dev escape hatch.
 */
export const trustedHeaderAuth: AuthFn<Request> = (request) => {
  const header = request.headers.get('x-eve-principal');
  if (!header) return null;
  try {
    const { userId, orgId } = verifyEvePrincipal(header);
    return {
      authenticator: 'zuko-trusted-header',
      principalId: String(userId),
      principalType: 'user',
      attributes: { orgId: String(orgId) },
    };
  } catch {
    return null; // present-but-invalid → unauthenticated, not a server error
  }
};

export default eveChannel({
  auth: [trustedHeaderAuth],
});
