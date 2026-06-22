import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // shiki gets auto-externalized by Turbopack with a broken hashed specifier
  // (ERR_MODULE_NOT_FOUND for `shiki-<hash>`) under bun's node_modules layout.
  // Transpiling it forces Turbopack to bundle it rather than emit that bad
  // external import.
  transpilePackages: ['@zuko/ui-kit', 'shiki'],
  // Enable standalone output for Docker deployment
  // This creates a minimal production server in .next/standalone/
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
