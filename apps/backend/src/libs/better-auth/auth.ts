import { betterAuth } from 'better-auth';
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
    socialProviders:
      GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
        ? { google: { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET } }
        : {},
  });
}

export type Auth = ReturnType<typeof createAuth>;
