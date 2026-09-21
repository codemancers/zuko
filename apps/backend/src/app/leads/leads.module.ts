import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
      useFactory: (
        repo: LeadsRepository,
        prisma: PrismaService,
        eventEmitter: EventEmitter2,
      ) => new LeadsService(repo, prisma, eventEmitter),
      inject: [LeadsRepository, PrismaService, EventEmitter2],
    },
  ],
  exports: [LeadsService],
})
export class LeadsModule {}
