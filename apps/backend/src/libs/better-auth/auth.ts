import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { ac, roles } from '@zuko/access-control';
import { audit } from '@zuko/better-auth-audit';
import { hierarchy } from '@zuko/better-auth-hierarchy';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import type { PrismaClient } from '../../generated/prisma/client';
import { AUTH_BASE_PATH, BACKEND_URL } from './constants';
import { auditSink } from './audit-sink';
import { cimdPlugin, jwtPlugin, mcpPlugin } from './mcp-plugins';
import { activeOrganizationOnSessionCreate } from './session-hooks';

export function createAuth(prisma: PrismaClient) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FRONTEND_URL } = process.env;

  return betterAuth({
    baseURL: BACKEND_URL,
    basePath: AUTH_BASE_PATH,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    trustedOrigins: FRONTEND_URL ? [FRONTEND_URL] : [],
    emailAndPassword: { enabled: true },
    advanced: { database: { generateId: 'serial' } },
    // The JWT plugin signs MCP access tokens; its own token route stays off.
    disabledPaths: ['/token'],
    // audit goes last so its hooks see events from the other plugins.
    plugins: [
      organization({ ac, roles, teams: { enabled: true } }),
      hierarchy(),
      jwtPlugin(),
      mcpPlugin(),
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
