/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  define: {
    // So React loads development build (with act) when tests import it
    'process.env.NODE_ENV': JSON.stringify('development'),
    'process.env.MEETINGS_ENABLED': JSON.stringify('true'),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@zuko/ui-kit': path.resolve(
        import.meta.dirname,
        '../../libs/ui-kit/src/index.ts',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    name: '@zuko/web',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    setupFiles: ['./__tests__/setup.ts'],
    reporters: ['default'],
    server: {
      deps: {
        inline: ['@zuko/ui-kit'],
      },
    },
    coverage: {
      exclude: ['node_modules/', '**/*.config.{ts,js,mts}', '__tests__/**'],
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
