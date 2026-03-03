import { composePlugins, withNx } from "@nx/next";
import type { WithNxOptions } from "@nx/next/plugins/with-nx";

const nextConfig: WithNxOptions = {
  // Use this to set Nx-specific options
  // See: https://nx.dev/recipes/next/next-config-setup
  nx: {},
  transpilePackages: ["@zuko/ui-kit"],
  // Enable standalone output for Docker deployment
  // This creates a minimal production server in .next/standalone/
  output: "standalone",
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

export default composePlugins(...plugins)(nextConfig);
