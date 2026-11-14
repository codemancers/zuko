import { betterAuth } from 'better-auth';
import { organization } from 'better-auth/plugins';
import { prismaAdapter } from '@better-auth/prisma-adapter';
import type { PrismaClient } from '../../generated/prisma/client';
import { AUTH_BASE_PATH, BACKEND_URL } from './constants';
import { activeOrganizationOnSessionCreate } from './session-hooks';

export function createAuth(prisma: PrismaClient) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FRONTEND_URL, RESEND_API_KEY, EMAIL_FROM } =
    process.env;

  async function sendResetPassword({ user, url }: { user: { email: string }; url: string }) {
    if (!RESEND_API_KEY || !EMAIL_FROM) {
      // Keep this endpoint's response identical for known and unknown emails. A
      // deployment without email configuration cannot deliver a link, but must
      // not turn that configuration mistake into an account-enumeration oracle.
      return;
    }

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [user.email],
          subject: 'Reset your Zuko password',
          html: `<p>We received a request to reset your Zuko password.</p><p><a href="${url}">Reset your password</a></p><p>This link expires soon and can only be used once. If you did not request this, you can ignore this email.</p>`,
        }),
      });
    } catch {
      // Keep provider outages indistinguishable from an unknown email address.
    }

    // Do not make delivery-provider details observable through the reset API.
    // The request endpoint intentionally returns the same response either way.
  }

  return betterAuth({
    baseURL: BACKEND_URL,
    basePath: AUTH_BASE_PATH,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    trustedOrigins: FRONTEND_URL ? [FRONTEND_URL] : [],
    emailAndPassword: {
      enabled: true,
      resetPasswordTokenExpiresIn: 3600,
      sendResetPassword,
    },
    advanced: { database: { generateId: 'serial' } },
    plugins: [organization()],
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
