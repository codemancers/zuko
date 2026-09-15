import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['agent/**/*.spec.ts'],
    // Same gate as other apps: CI's resource-constrained self-hosted runner
    // SIGINT-kills memory-heavy parallel vitest workers (exit 130). Run a
    // single serial fork in CI; keep default parallelism locally.
    ...(process.env['CI']
      ? {
          pool: 'forks' as const,
          poolOptions: { forks: { minForks: 1, maxForks: 1 } },
          fileParallelism: false,
        }
      : {}),
  },
});
