import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Prisma CLI runs from apps/backend; the shared .env lives at the workspace root.
config({ path: '../../.env', quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL },
});
