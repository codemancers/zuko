import { defineMcpClientConnection } from 'eve/connections';
import { signMcpToken, organizationClaim, userClaim, zukoMcpUrl } from '../lib/token';

export default defineMcpClientConnection({
  url: zukoMcpUrl,
  description:
    "Zuko CRM for the signed-in person's current organization. Search schemas and records, inspect history and relationships, and make permission-scoped changes.",
  protocolVersionDiscovery: false,
  auth: {
    principalType: 'user',
    getToken: async ({ principal }) => {
      if (principal.type !== 'user') throw new Error('Zuko requires a signed-in user');
      const userId = principal.attributes?.[userClaim];
      const organizationId = principal.attributes?.[organizationClaim];
      if (typeof userId !== 'string' || typeof organizationId !== 'string') {
        throw new Error('The Zuko session is missing its organization');
      }
      return signMcpToken(userId, organizationId);
    },
  },
  // Reads run immediately. Every mutation pauses until the signed-in person approves it.
  approval: ({ toolAnnotations }) =>
    toolAnnotations?.readOnlyHint === true ? 'not-applicable' : 'user-approval',
});
