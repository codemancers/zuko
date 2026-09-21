import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
      useFactory: (
        prospects: ProspectsRepository,
        leads: LeadsRepository,
        eventEmitter: EventEmitter2,
      ) => new ProspectsService(prospects, leads, eventEmitter),
      inject: [ProspectsRepository, LeadsRepository, EventEmitter2],
    },
  ],
  exports: [ProspectsService],
})
export class ProspectsModule {}
