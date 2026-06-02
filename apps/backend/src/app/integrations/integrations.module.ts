import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApolloIntegrationController } from './apollo/apollo-integration.controller';
import { ApolloIntegrationService } from './apollo/apollo-integration.service';
import { ApolloIntegrationRepository } from './apollo/apollo-integration.repository';
import { ApolloMcpService } from './apollo/apollo-mcp.service';
import { ApolloSequencesService } from './apollo/sequences/apollo-sequences.service';
import { ApolloSequencesController } from './apollo/sequences/apollo-sequences.controller';
import { CampaignsRepository } from '@zuko/sales';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [ApolloIntegrationController, ApolloSequencesController],
  providers: [
    OrganizationGuard,
    PrismaService,
    ApolloIntegrationRepository,
    ApolloIntegrationService,
    ApolloMcpService,
    ApolloSequencesService,
    {
      provide: CampaignsRepository,
      useFactory: (prismaService: PrismaService) =>
        new CampaignsRepository(prismaService),
      inject: [PrismaService],
    },
  ],
  exports: [ApolloIntegrationService, ApolloMcpService],
})
export class IntegrationsModule {}
