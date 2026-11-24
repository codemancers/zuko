import { NestLocalBuilder } from '@workflow/nest/builder';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const workingDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The SDK bundles the workflow and its step dependencies independently of webpack.
await new NestLocalBuilder({
  workingDir,
  dirs: ['src/workflows'],
  outDir: resolve(workingDir, 'dist/workflows'),
  moduleType: 'es6',
  basePath: '/api',
  sourcemap: false,
}).build();
