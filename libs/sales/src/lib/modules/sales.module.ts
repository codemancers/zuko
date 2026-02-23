import { Module } from '@nestjs/common';
import { ContactsRepository } from '../repositories/contacts.repository';
import { ContactsService } from '../services/contacts.service';
import { AccountsRepository } from '../repositories/accounts.repository';
import { AccountsService } from '../services/accounts.service';
import { DealsRepository } from '../repositories/deals.repository';
import { DealsService } from '../services/deals.service';
import { ActivityRepository } from '../repositories/activity.repository';
import { ActivityService } from '../services/activity.service';

@Module({
  providers: [
    ContactsRepository,
    ContactsService,
    AccountsRepository,
    AccountsService,
    DealsRepository,
    DealsService,
    ActivityRepository,
    ActivityService,
  ],
  exports: [
    ContactsRepository,
    ContactsService,
    AccountsRepository,
    AccountsService,
    DealsRepository,
    DealsService,
    ActivityRepository,
    ActivityService,
  ],
})
export class SalesModule {}
