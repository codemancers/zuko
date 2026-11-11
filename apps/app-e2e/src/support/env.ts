// Dedicated ports (dev uses 3000 and 4200) so reusing an already-running server is
// always safe: the only thing listening here is an e2e server on the test database.
// Limitation: Nx runs one `serve`/`dev` task at a time and Next.js allows one dev server
// per app directory, so stop your dev servers before running the e2e suite. To keep
// reruns fast, start the e2e servers yourself (same ports) and Playwright will reuse them.
export const APP_URL = 'http://localhost:4201';
export const BACKEND_URL = 'http://localhost:3100';

/**
 * e2e tests run against their own database so they never touch development
 * data. Override with E2E_DATABASE_URL; otherwise derive it from DATABASE_URL
 * (loaded from the workspace .env by Nx) by swapping the database name.
 */
export function testDatabaseUrl(): string {
  if (process.env['E2E_DATABASE_URL']) {
    return process.env['E2E_DATABASE_URL'];
  }
  const base = process.env['DATABASE_URL'];
  if (!base) {
    throw new Error('Set DATABASE_URL (in .env) or E2E_DATABASE_URL to run the e2e tests');
  }
  const url = new URL(base);
  url.pathname = '/zuko_test';
  return url.toString();
}
