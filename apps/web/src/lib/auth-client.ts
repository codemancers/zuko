import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';
import { oauthProviderClient } from '@better-auth/oauth-provider/client';

// Use the frontend's auth proxy to avoid third-party cookie issues
// The proxy at /auth forwards requests to the backend
// In development: http://localhost:3001/auth
// In production: Proxied through /auth (use window location for absolute URL)

// IMPORTANT: Always use the proxy in production on the client side
// The baseURL is determined at runtime, not build time
const getBaseURL = () => {
  // In production on client side, ALWAYS use the same-origin proxy
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return `${window.location.origin}/auth`;
  }

  // In development on client side, connect directly to backend
  if (typeof window !== 'undefined') {
    return 'http://localhost:3001/auth';
  }

  // During SSR/build (window undefined), use backend directly
  // This is only for build-time, not runtime
  return process.env.NEXT_PUBLIC_BACKEND_URL
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth`
    : 'http://localhost:3001/auth';
};

export const authClient = createAuthClient({
  // Call getBaseURL() on each request via baseURL getter
  get baseURL() {
    return getBaseURL();
  },
  fetchOptions: {
    credentials: 'include', // Ensure cookies are sent with requests
  },
  // Make sure default fetch plugins (including redirect plugin) are enabled
  disableDefaultFetchPlugins: false,
  plugins: [
    organizationClient({
      teams: {
        enabled: true,
      },
    }),
    oauthProviderClient(),
  ],
});
