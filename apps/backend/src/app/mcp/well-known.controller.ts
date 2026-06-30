import { Controller, Get } from '@nestjs/common';
import { auth, MCP_SCOPES } from '../../libs/better-auth/auth';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

const baseURL = process.env.BACKEND_URL || 'http://localhost:3001';

/**
 * Root-level OAuth discovery endpoints (excluded from the /api prefix in
 * main.ts). better-auth serves these under its basePath
 * (/auth/.well-known/…), but RFC 8414 clients resolve a path-based issuer
 * (`${baseURL}/auth`) at /.well-known/oauth-authorization-server/auth — and
 * several MCP clients fall back to the bare root path when they can't read
 * the WWW-Authenticate header.
 */
@AllowAnonymous()
@Controller('.well-known')
export class WellKnownController {
  @Get(['oauth-authorization-server/auth', 'oauth-authorization-server'])
  getAuthServerMetadata() {
    return auth.api.getOAuthServerConfig({});
  }

  @Get(['openid-configuration/auth', 'openid-configuration'])
  getOpenIdConfiguration() {
    return auth.api.getOpenIdConfig({});
  }

  // RFC 9728 protected-resource metadata for the MCP endpoint. MCP clients
  // hit this after a 401 from /api/mcp to find the authorization server.
  @Get('oauth-protected-resource/api/mcp')
  getProtectedResourceMetadata() {
    return {
      resource: `${baseURL}/api/mcp`,
      authorization_servers: [`${baseURL}/auth`],
      jwks_uri: `${baseURL}/auth/jwks`,
      scopes_supported: [...MCP_SCOPES, 'offline_access'],
      bearer_methods_supported: ['header'],
    };
  }
}
