import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:4200',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    // MCP clients read the OAuth resource-metadata pointer from 401
    // responses; without this, browsers strip the header and clients
    // fall back to guessing /.well-known paths.
    exposedHeaders: ['WWW-Authenticate'],
  });

  const globalPrefix = 'api';
  // Exclude auth routes from global prefix
  app.setGlobalPrefix(globalPrefix, {
    exclude: [
      'auth',
      '.well-known/workflow/(.*)',
      '.well-known/oauth-authorization-server',
      '.well-known/oauth-authorization-server/(.*)',
      '.well-known/openid-configuration',
      '.well-known/openid-configuration/(.*)',
      '.well-known/oauth-protected-resource/(.*)',
    ],
  });

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

  Logger.log(`🚀 Application is running on: http://localhost:${port}/api`);
  Logger.log(`🔐 Auth endpoints available at: http://localhost:${port}/auth`);
  Logger.log(`📖 Swagger UI available at: http://localhost:${port}/api/docs`);
  Logger.log(`🤖 MCP endpoint available at: http://localhost:${port}/api/mcp`);
}

bootstrap();
