import { mcpChannel } from 'eve/channels/mcp';
import { oauthResource } from 'eve/channels/auth';
import { zukoAuth } from '../lib/auth';
import { issuer, mcpResource } from '../lib/backend';

export default mcpChannel({
  tools: true,
  // Publish the funnel skills so external clients can read the procedures behind the tools.
  skills: true,
  auth: oauthResource(zukoAuth(false), {
    issuer,
    resource: mcpResource,
    metadataPath: '/eve/v1/mcp/metadata',
    scopes: ['records:read'],
  }),
});
