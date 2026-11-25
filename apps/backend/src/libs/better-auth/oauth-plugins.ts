import { cimd } from '@better-auth/cimd';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import { oauthProvider } from '@better-auth/oauth-provider';
import { APIError } from 'better-auth/api';
import { jwt } from 'better-auth/plugins';
import type { PrismaClient } from '../../generated/prisma/client';
import { createHarnessGrant, GRANT_CLAIM } from '../eve/harness-grants.service';
import {
  AGENT_SCOPE,
  HARNESS_RESOURCE,
  CONSENT_CLAIM,
  FRONTEND_ORIGIN,
  CRM_SCOPES,
  ORG_CLAIM,
} from './constants';

const IDENTITY_SCOPES = ['openid', 'offline_access'];
const GRANTABLE_SCOPES = [...Object.values(CRM_SCOPES), AGENT_SCOPE];

/** Signs the MCP access tokens. Must be registered before `oauthProviderPlugin()`. */
export const jwtPlugin = () => jwt({ disableSettingJwtHeader: true });

/** MCP clients that identify themselves with a Client ID Metadata Document instead of registering. */
export const cimdPlugin = () =>
  cimd({ fetchClientMetadataResource, metadataProfile: 'mcp-2026-07-28' });

/**
 * The backend issues OAuth tokens for the harness. The harness owns MCP transport
 * and protected-resource discovery; sign-in and consent happen on the frontend.
 *
 * A connection is bound to one organization: the one that is active in the user's
 * session when they authorize the client. It is stored with the consent and copied into
 * the access token, so an MCP request never depends on a web session. To connect a
 * different organization, switch to it in the app and connect again.
 */
export const oauthProviderPlugin = (prisma: PrismaClient) =>
  oauthProvider({
    accessTokenExpiresIn: 300,
    refreshTokenReuseInterval: 30,
    loginPage: `${FRONTEND_ORIGIN}/login`,
    consentPage: `${FRONTEND_ORIGIN}/consent`,
    scopes: [...IDENTITY_SCOPES, ...GRANTABLE_SCOPES],
    // Spelled out, with allowedScopes set: the Prisma adapter cannot store the null that
    // an unset scope list would otherwise become.
    resources: [{ identifier: HARNESS_RESOURCE, allowedScopes: GRANTABLE_SCOPES }],
    // MCP clients (Claude, Cursor, ...) register themselves. Registered clients start
    // with read access only and cannot claim more than the scopes listed here.
    allowDynamicClientRegistration: true,
    allowUnauthenticatedClientRegistration: true,
    clientRegistrationDefaultApplicationType: 'infer',
    clientRegistrationDefaultResources: [HARNESS_RESOURCE],
    clientRegistrationDefaultScopes: [CRM_SCOPES.recordsRead],
    clientRegistrationAllowedScopes: [...IDENTITY_SCOPES, ...GRANTABLE_SCOPES],
    postLogin: {
      // The user already has an organization in their session, or the flow stops.
      page: `${FRONTEND_ORIGIN}/organizations/new`,
      shouldRedirect: ({ session }) =>
        !(session as { activeOrganizationId?: unknown }).activeOrganizationId,
      consentReferenceId: ({ session }) => {
        const organizationId = (session as { activeOrganizationId?: unknown }).activeOrganizationId;
        if (organizationId == null || organizationId === '') {
          throw new APIError('BAD_REQUEST', {
            message: 'Select or create an organization before connecting an MCP client',
            code: 'NO_ACTIVE_ORGANIZATION',
          });
        }
        return String(organizationId);
      },
    },
    extensions: [
      {
        claims: {
          accessToken: async ({ ctx, user, client, referenceId, scopes }) => {
            const consent =
              user && referenceId
                ? await ctx.context.adapter.findOne<{ id: string; scopes: string[] }>({
                    model: 'oauthConsent',
                    where: [
                      { field: 'userId', value: user.id },
                      { field: 'clientId', value: client.clientId },
                      { field: 'referenceId', value: referenceId },
                    ],
                  })
                : null;
            if (!consent || !scopes.every((scope) => consent.scopes.includes(scope))) {
              throw new APIError('BAD_REQUEST', {
                error: 'invalid_grant',
                message: 'Approve this connection again',
              });
            }
            const grant = await createHarnessGrant(
              prisma,
              BigInt(user!.id),
              BigInt(referenceId!),
              'consent',
              BigInt(consent.id),
              scopes.filter((scope) => GRANTABLE_SCOPES.includes(scope)),
              new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            );
            return {
              [ORG_CLAIM]: referenceId,
              [CONSENT_CLAIM]: String(consent.id),
              [GRANT_CLAIM]: grant.reference,
            };
          },
        },
      },
    ],
  });
