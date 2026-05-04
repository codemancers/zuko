import { Module } from '@nestjs/common';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import { McpService } from './mcp.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DealsRepository,
  ContactsRepository,
  CompaniesRepository,
  CompaniesService,
  DealsService,
  TaskRepository,
  TableColumnRepository,
} from '@zuko/sales';

@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot()],
  providers: [
    McpService,
    {
      provide: DealsRepository,
      useFactory: (prisma: PrismaService) => new DealsRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ContactsRepository,
      useFactory: (prisma: PrismaService) => new ContactsRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CompaniesRepository,
      useFactory: (prisma: PrismaService) => new CompaniesRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: TableColumnRepository,
      useFactory: (prisma: PrismaService) => new TableColumnRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CompaniesService,
      useFactory: (
        companiesRepository: CompaniesRepository,
        eventEmitter: EventEmitter2,
        tableColumnRepository: TableColumnRepository,
      ) =>
        new CompaniesService(
          companiesRepository,
          eventEmitter,
          tableColumnRepository,
        ),
      inject: [CompaniesRepository, EventEmitter2, TableColumnRepository],
    },
    {
      provide: DealsService,
      useFactory: (
        dealsRepository: DealsRepository,
        eventEmitter: EventEmitter2,
        tableColumnRepository: TableColumnRepository,
      ) =>
        new DealsService(dealsRepository, eventEmitter, tableColumnRepository),
      inject: [DealsRepository, EventEmitter2, TableColumnRepository],
    },
    {
      provide: TaskRepository,
      useFactory: (prisma: PrismaService) => new TaskRepository(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [McpService],
})
export class McpModule {}
