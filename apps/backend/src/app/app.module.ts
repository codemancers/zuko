import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { testUtils } from 'better-auth/plugins';
import { ChatController } from '../chat/chat.controller';
import { ChatsModule } from '../chats/chats.module';
import { GraphController } from '../graph/graph.controller';
import { agentsEnvSchema } from './env.validation';
import { SalesModule } from './sales/sales.module';
import { AgentsWrapperModule } from './agents/agents.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test'
          ? ['.env.test.local', '.env.test']
          : ['.env.local', '.env'],
      validationSchema: agentsEnvSchema,
    }),
    PrismaModule,
    AuthModule.forRootAsync({
      imports: [PrismaModule],
      useFactory: (prismaService: PrismaService) => {
        // Check if email/password auth should be enabled (for testing purposes)
        const includeEmailAuth =
          process.env.BETTER_AUTH_INCLUDE_EMAILS_AUTH === 'true';

        return {
          auth: betterAuth({
            // basePath: where auth endpoints are mounted (proxy forwards /api/auth/* to backend /auth/*)
            // In prod: proxy at /api/auth forwards to backend, so backend still serves at /auth
            basePath: '/auth',
            // baseURL: full URL where auth endpoints are publicly accessible
            // In prod: use frontend URL (OAuth callbacks go through proxy)
            // In dev: use backend URL directly
            baseURL:
              process.env.NODE_ENV === 'production'
                ? process.env.FRONTEND_URL || 'https://zuko-webv-5725.fly.dev'
                : process.env.BACKEND_URL || 'http://localhost:3001',
            // Explicitly set secret to ensure consistency between tests and runtime
            secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET,
            trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',') ?? [
              'http://localhost:3000',
              'http://localhost:3001',
              'http://localhost:4200',
            ],
            database: prismaAdapter(prismaService, {
              provider: 'postgresql',
            }),
            plugins: [
              ...(process.env.NODE_ENV === 'test' ? [testUtils()] : []),
            ],
            emailAndPassword: {
              enabled: includeEmailAuth,
            },
            socialProviders: {
              github: {
                clientId: process.env.GITHUB_CLIENT_ID ?? '',
                clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
              },
            },
            account: {
              // Use database instead of cookies for OAuth state to avoid cross-origin issues
              storeStateStrategy: 'database',
              // Temporarily skip state cookie check to debug cross-origin issues
              skipStateCookieCheck: true,
            },
            session: {
              expiresIn: 60 * 60 * 24 * 7, // 7 days
              updateAge: 60 * 60 * 24, // 1 day
              cookieCache: {
                enabled: true,
                maxAge: 60 * 5, // 5 minutes
              },
            },
            advanced: {
              database: {
                generateId: 'serial',
              },
              // Use secure cookies only in production (HTTPS)
              // In development (HTTP/localhost), cookies must use secure: false
              useSecureCookies: process.env.NODE_ENV === 'production',
              defaultCookieAttributes:
                process.env.NODE_ENV === 'production'
                  ? {
                      sameSite: 'none', // Allow cross-origin requests
                      secure: true, // HTTPS only
                    }
                  : {
                      sameSite: 'lax', // Standard for same-origin
                      secure: false, // Allow HTTP in development
                    },
            },
          }),
          disableGlobalAuthGuard: true,
        };
      },
      inject: [PrismaService],
    }),
    AgentsWrapperModule,
    SalesModule,
    ChatsModule,
    AdminModule,
  ],
  controllers: [AppController, ChatController, GraphController],
  providers: [AppService],
})
export class AppModule {}
