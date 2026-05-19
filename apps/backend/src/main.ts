/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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
  app.setGlobalPrefix(globalPrefix, { exclude: ['auth', '.well-known/(.*)'] });

  const basePort = process.env.PORT || 3000;
  const port = parseInt(basePort as string) + 1;

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Zuko API')
    .setDescription('Zuko CRM & AI Backend API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'session',
    )
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'agent-jwt',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(port);
  Logger.log(
    `🚀 Application is running on: http://localhost:${port}/${globalPrefix}`,
  );
  Logger.log(`🔐 Auth endpoints available at: http://localhost:${port}/auth`);
  Logger.log(`📖 Swagger UI available at: http://localhost:${port}/api/docs`);
}

bootstrap();
