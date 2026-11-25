/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  // The better-auth module parses its own bodies and re-adds Nest's parsers for other routes.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableShutdownHooks();
  const globalPrefix = 'api';
  // The browser app lives on another origin and sends its session cookie. These are the
  // same origins better-auth trusts (see libs/better-auth/auth.ts).
  const { FRONTEND_URL } = process.env;
  app.enableCors({
    origin: FRONTEND_URL ? [FRONTEND_URL] : false,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  // OAuth issuer discovery is fetched from the origin root, not under /api.
  app.setGlobalPrefix(globalPrefix, {
    exclude: [{ path: '.well-known/*path', method: RequestMethod.GET }],
  });
  const port = process.env.PORT || 3000;
  await app.listen(port);
  // Set when Nx waits for this server to be ready
  if (process.env.NX_READY_SIGNAL_SOCKET) {
    try {
      // Function keeps TypeScript and bundlers from rewriting or bundling the import
      const load = new Function('s', 'return import(s)') as (
        s: string,
      ) => Promise<{ emitReadySignal(server: unknown): boolean }>;
      (await load('@nx/js/ready-signal')).emitReadySignal(app.getHttpServer());
    } catch {
      // @nx/js isn't installed
    }
  }
  Logger.log(`🚀 Application is running on: http://localhost:${port}/${globalPrefix}`);
}

bootstrap();
