import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { CompaniesController } from './companies.controller';
import { DealsController } from './deals.controller';
import {
  ActivitiesController,
  ContactActivitiesController,
  CompanyActivitiesController,
} from './activities.controller';
import { ViewsController } from './views.controller';
import { ViewsService } from './views.service';
import {
  ContactsRepository,
  ContactsService,
  CompaniesRepository,
  CompaniesService,
  DealsRepository,
  DealsService,
  ActivityRepository,
  ActivityService,
} from '@zuko/sales';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationGuard } from '../../common/auth/organization.guard';

@Module({
  imports: [PrismaModule],
  controllers: [
    ContactsController,
    CompaniesController,
    DealsController,
    ActivitiesController,
    ContactActivitiesController,
    CompanyActivitiesController,
    ViewsController,
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
      useFactory: (contactsRepository: ContactsRepository) => {
        return new ContactsService(contactsRepository);
      },
      inject: [ContactsRepository],
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
      useFactory: (companiesRepository: CompaniesRepository) => {
        return new CompaniesService(companiesRepository);
      },
      inject: [CompaniesRepository],
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
      useFactory: (dealsRepository: DealsRepository) => {
        return new DealsService(dealsRepository);
      },
      inject: [DealsRepository],
    },
    ViewsService,
  ],
})
export class SalesModule {}
