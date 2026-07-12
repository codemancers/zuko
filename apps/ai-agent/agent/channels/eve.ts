import { eveChannel } from 'eve/channels/eve';
import { type AuthFn, UnauthenticatedError } from 'eve/channels/auth';
import { env } from '../lib/env';

interface BetterAuthSession {
  user: { id: string; email: string; name: string };
  session: { id: string; activeOrganizationId?: string };
}

function betterAuth(): AuthFn<Request> {
  return async (request) => {
    const backendUrl = env().ZUKO_BACKEND_URL;

    // Prefer cookie from request (HTTP API / browser); fall back to env (TUI dev)
    const cookieFromRequest = request.headers.get('cookie');
    const cookieFromEnv = env().ZUKO_SESSION_TOKEN
      ? `better-auth.session_token=${env().ZUKO_SESSION_TOKEN}`
      : null;
    const sessionCookie = cookieFromRequest || cookieFromEnv;
    if (!sessionCookie) return null;

    const res = await fetch(`${backendUrl}/auth/get-session`, {
      headers: { cookie: sessionCookie },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as BetterAuthSession | null;
    if (!data?.user?.id) return null;

    const orgId = data.session?.activeOrganizationId;
    if (!orgId) {
      throw new UnauthenticatedError({
        message: 'No active organization on session. Select one first.',
      });
    }

    return {
      authenticator: 'betterAuth',
      issuer: backendUrl,
      principalId: data.user.id,
      principalType: 'user',
      subject: data.user.email,
      attributes: {
        orgId,
        userId: data.user.id,
        sessionCookie,
      },
    };
  };
}

export default eveChannel({ auth: [betterAuth()] });
