//@ts-check

const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js options go here
  // See: https://nextjs.org/docs/app/api-reference/config/next-config-js
};

const pageExtensions = ['js', 'jsx', 'ts', 'tsx'];

/**
 * Dev-only pages are named `page.dev.tsx` (e.g. /design-system). The `dev.tsx`
 * extension is only registered for `next dev`, so `next build` never sees them
 * as routes: they are not compiled, not bundled, and 404 in production.
 *
 * @param {string} phase
 * @returns {import('next').NextConfig}
 */
module.exports = (phase) => ({
  ...nextConfig,
  pageExtensions:
    phase === PHASE_DEVELOPMENT_SERVER ? ['dev.tsx', ...pageExtensions] : pageExtensions,
});
