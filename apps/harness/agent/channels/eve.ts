import { eveChannel } from 'eve/channels/eve';
import {
  extractBearerToken,
  localDev,
  verifyJwtHmac,
  withAuthChallenges,
  type AuthFn,
} from 'eve/channels/auth';
import { eveIssuer, eveRouteAudience, eveSecret, organizationClaim, userClaim } from '../lib/token';

const zukoSession: AuthFn<Request> = withAuthChallenges(
  async (request) => {
    const result = await verifyJwtHmac(extractBearerToken(request.headers.get('authorization')), {
      algorithm: 'HS256',
      issuer: eveIssuer,
      audiences: [eveRouteAudience],
      secret: eveSecret(),
    });
    if (!result.ok) return null;
    const userId = result.sessionAuth.attributes[userClaim];
    const organizationId = result.sessionAuth.attributes[organizationClaim];
    if (typeof userId !== 'string' || typeof organizationId !== 'string') return null;
    return {
      ...result.sessionAuth,
      authenticator: 'zuko',
      principalType: 'user',
      // The organization is part of the identity, so sessions cannot cross an org switch.
      principalId: `user:${userId}:organization:${organizationId}`,
    };
  },
  [{ scheme: 'Bearer' }],
);

export default eveChannel({ auth: [zukoSession, localDev()] });
