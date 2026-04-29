import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@zuko/ui-kit'],
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
