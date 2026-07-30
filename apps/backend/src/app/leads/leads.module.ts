import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { LeadsRepository } from '@zuko/sales';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  imports: [PrismaModule],
  controllers: [LeadsController],
  providers: [
    OrganizationGuard,
    {
      provide: LeadsRepository,
      useFactory: (prisma: PrismaService) => new LeadsRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: LeadsService,
      useFactory: (repo: LeadsRepository, prisma: PrismaService) =>
        new LeadsService(repo, prisma),
      inject: [LeadsRepository, PrismaService],
    },
  ],
})
export class LeadsModule {}
