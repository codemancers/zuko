import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { ac, roles } from '@zuko/access-control';
import { audit } from '@zuko/better-auth-audit';
import { hierarchy } from '@zuko/better-auth-hierarchy';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import type { PrismaClient } from '../../generated/prisma/client';
import { AUTH_BASE_PATH, BACKEND_URL } from './constants';
import { auditSink } from './audit-sink';
import { hierarchyTransaction } from './hierarchy-transaction';
import { cimdPlugin, jwtPlugin, oauthProviderPlugin } from './oauth-plugins';
import { activeOrganizationOnSessionCreate } from './session-hooks';

export function createAuth(
  prisma: PrismaClient,
  setupOrganization?: (organizationId: bigint) => Promise<void>,
) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FRONTEND_URL } = process.env;

  return betterAuth({
    baseURL: BACKEND_URL,
    basePath: AUTH_BASE_PATH,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    trustedOrigins: FRONTEND_URL ? [FRONTEND_URL] : [],
    emailAndPassword: { enabled: true },
    advanced: { database: { generateId: 'serial' } },
    // JWT signing serves OAuth access, browser route tokens and CRM delegation; its own token route stays off.
    disabledPaths: ['/token'],
    // audit goes last so its hooks see events from the other plugins.
    plugins: [
      organization({
        ac,
        roles,
        teams: { enabled: true },
        schema: {
          organization: {
            additionalFields: {
              setupRunId: { type: 'string', required: false, input: false },
            },
          },
        },
        organizationHooks: {
          afterCreateOrganization: async ({ organization }) => {
            // Organization creation succeeds even if dispatch is temporarily unavailable.
            // The background reconciler attaches missing setup runs after recovery.
            try {
              await setupOrganization?.(BigInt(organization.id));
            } catch (error) {
              console.error('Could not attach organization setup workflow', error);
            }
          },
        },
      }),
      hierarchy({ transaction: hierarchyTransaction(prisma) }),
      jwtPlugin(),
      oauthProviderPlugin(prisma),
      cimdPlugin(),
      audit({ write: auditSink(prisma) }),
    ],
    databaseHooks: {
      session: {
        create: {
          // Start every session in the user's first organization, if they have one.
          before: activeOrganizationOnSessionCreate(prisma),
        },
      },
    },
    socialProviders:
      GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
        ? { google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET } }
        : {},
  });
}

export type Auth = ReturnType<typeof createAuth>;
