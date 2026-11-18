import { createAuthClient } from 'better-auth/react';
import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { organizationClient } from 'better-auth/client/plugins';

// Must match the backend's BACKEND_URL (the better-auth issuer) and AUTH_BASE_PATH.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000',
  basePath: '/auth',
  plugins: [organizationClient({ teams: { enabled: true } }), oauthProviderClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
