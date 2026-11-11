/**
 * Single public backend origin. It is also the better-auth issuer, since
 * better-auth is mounted in-process at AUTH_BASE_PATH. Every issuer/audience/
 * JWKS/redirect URL must derive from this constant, never re-read the env var.
 */
export const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;

export const AUTH_BASE_PATH = '/auth';
