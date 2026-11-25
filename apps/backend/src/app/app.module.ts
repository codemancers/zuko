import { OrganizationSetupModule } from '../organization-setup/setup.module';
import { OrganizationSetupService } from '../organization-setup/setup.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { CrmModule } from '../crm/crm.module';
import { createAuth } from '../libs/better-auth/auth';
import { ConnectionsModule } from '../connections/connections.module';
import { WellKnownController } from '../libs/better-auth/well-known.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    PrismaModule,
    OrganizationSetupModule,
    CrmModule,
    ConnectionsModule,
    AuthModule.forRootAsync({
      imports: [OrganizationSetupModule],
      inject: [PrismaService, OrganizationSetupService],
      // CORS is enabled in main.ts: the module's own handling hardcodes GET/POST/PUT/DELETE,
      // which leaves out PATCH (record updates).
      useFactory: (prisma: PrismaService, setup: OrganizationSetupService) => ({
        auth: createAuth(prisma, (id) => setup.attach(id)),
        disableTrustedOriginsCors: true,
      }),
    }),
  ],
  controllers: [AppController, WellKnownController],
  providers: [AppService],
})
export class AppModule {}
