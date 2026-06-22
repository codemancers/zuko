import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApolloIntegrationController } from './apollo/apollo-integration.controller';
import { ApolloIntegrationService } from './apollo/apollo-integration.service';
import { ApolloIntegrationRepository } from './apollo/apollo-integration.repository';
import { ApolloMcpService } from './apollo/apollo-mcp.service';
import { ApolloSequencesService } from './apollo/sequences/apollo-sequences.service';
import { ApolloSequencesController } from './apollo/sequences/apollo-sequences.controller';
import { ApolloProspectsService } from './apollo/prospects/apollo-prospects.service';
import { ApolloProspectsController } from './apollo/prospects/apollo-prospects.controller';
import { CampaignsRepository, ContactsRepository } from '@zuko/sales';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    ApolloIntegrationController,
    ApolloSequencesController,
    ApolloProspectsController,
  ],
  providers: [
    OrganizationGuard,
    PrismaService,
    ApolloIntegrationRepository,
    ApolloIntegrationService,
    ApolloMcpService,
    ApolloSequencesService,
    ApolloProspectsService,
    {
      provide: CampaignsRepository,
      useFactory: (prismaService: PrismaService) =>
        new CampaignsRepository(prismaService),
      inject: [PrismaService],
    },
    {
      provide: ContactsRepository,
      useFactory: (prismaService: PrismaService) =>
        new ContactsRepository(prismaService),
      inject: [PrismaService],
    },
  ],
  exports: [ApolloIntegrationService, ApolloMcpService],
})
export class IntegrationsModule {}
