/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  // Disable body parser for better-auth to handle raw request bodies
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Enable CORS for frontend requests
  // origin must be explicit (not true) when credentials: true
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4200',
    'https://zuko-webv-5725.fly.dev',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const globalPrefix = 'api';
  // Exclude auth routes from global prefix
  app.setGlobalPrefix(globalPrefix, { exclude: ['auth'] });

  const basePort = process.env.PORT || 3000;
  const port = parseInt(basePort) + 1;
  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`
  );
  Logger.log(
    `🔐 Auth endpoints available at: http://localhost:${port}/auth`
  );
}

bootstrap();
