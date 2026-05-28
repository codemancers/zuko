import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { ApolloService } from './apollo.service';
import { IcpController } from './icp.controller';
import { IcpRepository } from './icp.repository';
import { IcpService } from './icp.service';

@Module({
  imports: [PrismaModule],
  controllers: [IcpController],
  providers: [
    OrganizationGuard,
    ApolloService,
    {
      provide: IcpRepository,
      useFactory: (prisma: PrismaService) => new IcpRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: IcpService,
      useFactory: (repo: IcpRepository, apollo: ApolloService) =>
        new IcpService(repo, apollo),
      inject: [IcpRepository, ApolloService],
    },
  ],
})
export class IcpModule {}
