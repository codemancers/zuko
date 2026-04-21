import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@zuko/ai-agents',
    globals: true,
    environment: 'node',
    watch: false,
    include: ['src/**/*.spec.ts'],
    passWithNoTests: true,
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
