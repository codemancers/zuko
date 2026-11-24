import apollo from '@kosha-ai/integration-apollo';
import { defineConfig } from '@kosha-ai/server';

const port = Number(process.env.PORT ?? 3333);
const adminPort = Number(process.env.ADMIN_PORT ?? 3000);
const publicUrl = process.env.KOSHA_PUBLIC_URL ?? `http://localhost:${port}`;

export default defineConfig({
  database: {
    url: process.env.DATABASE_URL as string,
  },
  auth: {
    secret: process.env.KOSHA_SECRET as string,
    baseURL: publicUrl,
    trustedOrigins: [publicUrl, process.env.ADMIN_URL ?? `http://localhost:${adminPort}`],
  },
  encryption: {
    // Rotating this key strands every encrypted Apollo credential already stored.
    key: process.env.KOSHA_ENCRYPTION_KEY as string,
  },
  server: {
    port,
    publicUrl,
  },
  admin: {
    port: adminPort,
  },
  integrations: [apollo()],
});
