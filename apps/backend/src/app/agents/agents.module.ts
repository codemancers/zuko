import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentGuard } from '../../common/auth/agent.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentsController } from './agents.controller';
import {
  ContactsService,
  CompaniesService,
  DealsService,
  ActivityService,
  ContactsRepository,
  CompaniesRepository,
  DealsRepository,
  ActivityRepository,
  TableColumnRepository
} from '@zuko/sales';

@Module({
  imports: [PrismaModule],
  controllers: [AgentsController],
  providers: [AgentGuard,
    {
      provide: ContactsRepository,
      useFactory: (prismaService: PrismaService) => {
        return new ContactsRepository(prismaService);
      },
      inject: [PrismaService],
    },
    {
      provide: ContactsService,
      useFactory: (contactsRepository: ContactsRepository, eventEmitter: EventEmitter2, tableColumnRepository: TableColumnRepository) => {
        return new ContactsService(contactsRepository, eventEmitter, tableColumnRepository);
      },
      inject: [ContactsRepository, EventEmitter2],
    },
    {
      provide: CompaniesRepository,
      useFactory: (prismaService: PrismaService) => {
        return new CompaniesRepository(prismaService);
      },
      inject: [PrismaService],
    },
    {
      provide: CompaniesService,
      useFactory: (companiesRepository: CompaniesRepository, eventEmitter: EventEmitter2, tableColumnRepository: TableColumnRepository) => {
        return new CompaniesService(companiesRepository, eventEmitter, tableColumnRepository);
      },
      inject: [CompaniesRepository, EventEmitter2],
    },
    {
      provide: DealsRepository,
      useFactory: (prismaService: PrismaService) => {
        return new DealsRepository(prismaService);
      },
      inject: [PrismaService],
    },
    {
      provide: ActivityRepository,
      useFactory: (prismaService: PrismaService) => {
        return new ActivityRepository(prismaService);
      },
      inject: [PrismaService],
    },
    {
      provide: ActivityService,
      useFactory: (activityRepository: ActivityRepository) => {
        return new ActivityService(activityRepository);
      },
      inject: [ActivityRepository],
    },
    {
      provide: DealsService,
      useFactory: (dealsRepository: DealsRepository, eventEmitter: EventEmitter2, tableColumnRepository: TableColumnRepository) => {
        return new DealsService(dealsRepository, eventEmitter, tableColumnRepository);
      },
      inject: [DealsRepository, EventEmitter2],
    },
  ],
})
export class AgentsWrapperModule {}
