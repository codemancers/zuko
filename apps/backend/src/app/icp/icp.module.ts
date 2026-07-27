import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ApolloService } from './apollo.service';
import { IcpLlmService } from './icp-llm.service';
import { IcpController } from './icp.controller';
import { IcpRepository } from './icp.repository';
import { IcpService } from './icp.service';

@Module({
  imports: [PrismaModule, IntegrationsModule],
  controllers: [IcpController],
  providers: [
    OrganizationGuard,
    ApolloService,
    IcpLlmService,
    {
      provide: IcpRepository,
      useFactory: (prisma: PrismaService) => new IcpRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: IcpService,
      useFactory: (
        repo: IcpRepository,
        apollo: ApolloService,
        llm: IcpLlmService,
      ) => new IcpService(repo, apollo, llm),
      inject: [IcpRepository, ApolloService, IcpLlmService],
    },
  ],
})
export class IcpModule {}
