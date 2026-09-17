import { Module } from '@nestjs/common';
import {
  LeadsRepository,
  ProspectsRepository,
  ProspectsService,
} from '@zuko/sales';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { ProspectsController } from './prospects.controller';

@Module({
  imports: [PrismaModule],
  controllers: [ProspectsController],
  providers: [
    OrganizationGuard,
    {
      provide: ProspectsRepository,
      useFactory: (prisma: PrismaService) => new ProspectsRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: LeadsRepository,
      useFactory: (prisma: PrismaService) => new LeadsRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ProspectsService,
      useFactory: (prospects: ProspectsRepository, leads: LeadsRepository) =>
        new ProspectsService(prospects, leads),
      inject: [ProspectsRepository, LeadsRepository],
    },
  ],
  exports: [ProspectsService],
})
export class ProspectsModule {}
