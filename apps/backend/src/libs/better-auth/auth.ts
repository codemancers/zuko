import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import type { PrismaClient } from '../../generated/prisma/client';
import { AUTH_BASE_PATH, BACKEND_URL } from './constants';

export function createAuth(prisma: PrismaClient) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FRONTEND_URL } = process.env;

  return betterAuth({
    baseURL: BACKEND_URL,
    basePath: AUTH_BASE_PATH,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    trustedOrigins: FRONTEND_URL ? [FRONTEND_URL] : [],
    emailAndPassword: { enabled: true },
    plugins: [organization()],
    databaseHooks: {
      session: {
        create: {
          // Start every session in the user's first organization, if they have one.
          before: async (session) => {
            const membership = await prisma.member.findFirst({
              where: { userId: session.userId },
              orderBy: { createdAt: 'asc' },
              select: { organizationId: true },
            });
            return { data: { ...session, activeOrganizationId: membership?.organizationId ?? null } };
          },
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
