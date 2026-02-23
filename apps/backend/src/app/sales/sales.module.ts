import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { AccountsController } from './accounts.controller';
import { DealsController } from './deals.controller';
import { ActivitiesController, ContactActivitiesController, AccountActivitiesController } from './activities.controller';
import {
  ContactsRepository,
  ContactsService,
  AccountsRepository,
  AccountsService,
  DealsRepository,
  DealsService,
  ActivityRepository,
  ActivityService,
} from '@zuko/sales';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContactsController, AccountsController, DealsController, ActivitiesController, ContactActivitiesController, AccountActivitiesController],
  providers: [
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
      provide: AccountsRepository,
      useFactory: (prismaService: PrismaService) => {
        return new AccountsRepository(prismaService);
      },
      inject: [PrismaService],
    },
    {
      provide: AccountsService,
      useFactory: (accountsRepository: AccountsRepository) => {
        return new AccountsService(accountsRepository);
      },
      inject: [AccountsRepository],
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
  ],
})
export class SalesModule {}
