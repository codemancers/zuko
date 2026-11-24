//@ts-check

const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the development overlay from covering account controls in the sidebar.
  devIndicators: false,
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
const zukoConfig = (phase) => ({
  ...nextConfig,
  pageExtensions:
    phase === PHASE_DEVELOPMENT_SERVER ? ['dev.tsx', ...pageExtensions] : pageExtensions,
});

module.exports = async (phase, context) => {
  const { withEve } = await import('eve/next');
  return withEve(zukoConfig, { eveRoot: '../..' })(phase, context);
};
