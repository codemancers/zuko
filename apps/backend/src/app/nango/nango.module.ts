import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NangoService } from './nango.service';
import { NangoConnectController } from './nango-connect.controller';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [NangoConnectController],
  providers: [NangoService, OrganizationGuard],
  exports: [NangoService],
})
export class NangoModule {}
