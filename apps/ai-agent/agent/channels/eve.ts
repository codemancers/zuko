import { eveChannel } from 'eve/channels/eve';
import { type AuthFn, UnauthenticatedError, localDev } from 'eve/channels/auth';
import { env } from '../lib/env';

interface BetterAuthSession {
  user: { id: string; email: string; name: string };
  session: { id: string; activeOrganizationId?: string };
}

function betterAuth(): AuthFn<Request> {
  return async (request) => {
    const backendUrl = env().ZUKO_BACKEND_URL;
    const res = await fetch(`${backendUrl}/auth/get-session`, {
      headers: request.headers,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as BetterAuthSession | null;
    if (!data?.user?.id) return null;

    const orgId = data.session?.activeOrganizationId;
    if (!orgId) {
      throw new UnauthenticatedError({
        body: JSON.stringify({
          error: 'No active organization on session. Select one first.',
        }),
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
      },
    };
  };
}

export default eveChannel({
  auth: [
    // localDev() bypasses auth for TUI testing — uncomment to skip session checks locally.
    // localDev(),
    betterAuth(),
  ],
});
