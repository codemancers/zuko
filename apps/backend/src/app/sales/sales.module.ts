import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ContactsController } from './contacts.controller';
import { CompaniesController } from './companies.controller';
import { DealsController } from './deals.controller';
import {
  ActivitiesController,
  ContactActivitiesController,
  CompanyActivitiesController,
  DealActivitiesController,
} from './activities.controller';
import {
  ContactsRepository,
  ContactsService,
  CompaniesRepository,
  CompaniesService,
  DealsRepository,
  DealsService,
  ActivityRepository,
  ActivityService,
  DealActivityListener,
  ContactActivityListener,
  CompanyActivityListener,
} from '@zuko/sales';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { TableController } from './table/table.controller';
import { TableService } from './table/table.service';
import { TableRowBuilder } from './table/row-builder/table-row.builder';

@Module({
  imports: [PrismaModule],
  controllers: [
    ContactsController,
    CompaniesController,
    DealsController,
    ActivitiesController,
    ContactActivitiesController,
    CompanyActivitiesController,
    DealActivitiesController,
    TableController,
  ],
  providers: [
    OrganizationGuard,
    {
      provide: ContactsRepository,
      useFactory: (prismaService: PrismaService) => {
        return new ContactsRepository(prismaService);
      },
      inject: [PrismaService],
    },
    {
      provide: ContactsService,
      useFactory: (contactsRepository: ContactsRepository, eventEmitter: EventEmitter2) => {
        return new ContactsService(contactsRepository, eventEmitter);
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
      useFactory: (companiesRepository: CompaniesRepository, eventEmitter: EventEmitter2) => {
        return new CompaniesService(companiesRepository, eventEmitter);
      },
      inject: [CompaniesRepository, EventEmitter2],
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
      provide: DealsRepository,
      useFactory: (prismaService: PrismaService) => {
        return new DealsRepository(prismaService);
      },
      inject: [PrismaService],
    },
    {
      provide: DealsService,
      useFactory: (dealsRepository: DealsRepository, eventEmitter: EventEmitter2) => {
        return new DealsService(dealsRepository, eventEmitter);
      },
      inject: [DealsRepository, EventEmitter2],
    },
    {
      provide: DealActivityListener,
      useFactory: (activityService: ActivityService) => {
        return new DealActivityListener(activityService);
      },
      inject: [ActivityService],
    },
    {
      provide: ContactActivityListener,
      useFactory: (activityService: ActivityService) => {
        return new ContactActivityListener(activityService);
      },
      inject: [ActivityService],
    },
    {
      provide: CompanyActivityListener,
      useFactory: (activityService: ActivityService) => {
        return new CompanyActivityListener(activityService);
      },
      inject: [ActivityService],
    },
    TableService,
    TableRowBuilder,
  ],
})
export class SalesModule {}
