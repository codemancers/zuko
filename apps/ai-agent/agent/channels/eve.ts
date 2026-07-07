import { eveChannel } from 'eve/channels/eve';
import { jwtHmac, localDev } from 'eve/channels/auth';

export default eveChannel({
  auth: [
    // Loopback requests accepted in dev without a token.
    localDev(),
    // Production: caller must present a Bearer JWT signed with EVE_AUTH_SECRET.
    jwtHmac({
      algorithm: 'HS256',
      secret: process.env.EVE_AUTH_SECRET!,
      issuer: 'zuko',
      audiences: ['zuko-ai-agent'],
    }),
  ],
});
