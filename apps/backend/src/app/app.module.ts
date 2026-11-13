import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { createAuth } from '../libs/better-auth/auth';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrganizationAccessController } from '../organizations/organization-access.controller';
import { OrganizationAccessGuard } from '../organizations/organization-access.guard';

@Module({
  imports: [
    PrismaModule,
    AuthModule.forRootAsync({
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({ auth: createAuth(prisma) }),
    }),
  ],
  controllers: [AppController, OrganizationAccessController],
  providers: [AppService, { provide: APP_GUARD, useClass: OrganizationAccessGuard }],
})
export class AppModule {}
