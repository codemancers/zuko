import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApolloIntegrationController } from './apollo/apollo-integration.controller';
import { ApolloIntegrationService } from './apollo/apollo-integration.service';
import { ApolloIntegrationRepository } from './apollo/apollo-integration.repository';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [ApolloIntegrationController],
  providers: [
    OrganizationGuard,
    PrismaService,
    ApolloIntegrationRepository,
    ApolloIntegrationService,
  ],
  exports: [ApolloIntegrationService],
})
export class IntegrationsModule {}
