import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { testUtils } from 'better-auth/plugins';
import { organization } from 'better-auth/plugins';
import { PrismaService } from '../../prisma/prisma.service';

const prisma = new PrismaService();

const includeEmailAuth =
  process.env.NEXT_PUBLIC_BETTER_AUTH_INCLUDE_EMAILS_AUTH === 'true';

async function getInitialOrganization(userId: number) {
  const membership = await prisma.member.findFirst({
    where: { userId },
    include: {
      organization: true,
    },
  });
  return membership?.organization;
}

export const auth = betterAuth({
  // basePath: where auth endpoints are mounted (proxy forwards /api/auth/* to backend /auth/*)
  // In prod: proxy at /api/auth forwards to backend, so backend still serves at /auth
  basePath: '/auth',
  // baseURL: full URL where auth endpoints are publicly accessible
  // In prod: use frontend URL (OAuth callbacks go through proxy)
  // In dev: use backend URL directly
  baseURL:
    process.env.NODE_ENV === 'production'
      ? process.env.FRONTEND_URL || 'https://zuko-webv-5725.fly.dev'
      : process.env.BACKEND_URL || 'http://localhost:3001',
  // Explicitly set secret to ensure consistency between tests and runtime
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',') ?? [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:4200',
  ],
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  plugins: [
    ...(process.env.NODE_ENV === 'test' ? [testUtils()] : []),
    organization({
      teams: {
        enabled: true,
      },
    }),
  ],
  emailAndPassword: {
    enabled: includeEmailAuth,
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
  },
  account: {
    // Use database instead of cookies for OAuth state to avoid cross-origin issues
    storeStateStrategy: 'database',
    // Temporarily skip state cookie check to debug cross-origin issues
    skipStateCookieCheck: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  advanced: {
    database: {
      generateId: 'serial',
    },
    // Use secure cookies only in production (HTTPS)
    // In development (HTTP/localhost), cookies must use secure: false
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes:
      process.env.NODE_ENV === 'production'
        ? {
            sameSite: 'none', // Allow cross-origin requests
            secure: true, // HTTPS only
          }
        : {
            sameSite: 'lax', // Standard for same-origin
            secure: false, // Allow HTTP in development
          },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const organization = await getInitialOrganization(
            Number(session.userId),
          );
          return {
            data: {
              ...session,
              activeOrganizationId: organization?.id?.toString(),
            },
          };
        },
      },
    },
  },
});
