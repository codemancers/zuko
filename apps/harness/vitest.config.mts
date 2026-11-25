import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'harness',
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
  },
});
