import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@zuko/backend-e2e',
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    globalSetup: ['src/support/global-setup.ts'],
    setupFiles: ['src/support/test-setup.ts'],
    passWithNoTests: true,
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
