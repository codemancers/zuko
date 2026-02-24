import { Module } from '@nestjs/common';
import { ContactsRepository } from '../repositories/contacts.repository';
import { ContactsService } from '../services/contacts.service';
import { CompaniesRepository } from '../repositories/companies.repository';
import { CompaniesService } from '../services/companies.service';
import { DealsRepository } from '../repositories/deals.repository';
import { DealsService } from '../services/deals.service';
import { ActivityRepository } from '../repositories/activity.repository';
import { ActivityService } from '../services/activity.service';

@Module({
  providers: [
    ContactsRepository,
    ContactsService,
    CompaniesRepository,
    CompaniesService,
    DealsRepository,
    DealsService,
    ActivityRepository,
    ActivityService,
  ],
  exports: [
    ContactsRepository,
    ContactsService,
    CompaniesRepository,
    CompaniesService,
    DealsRepository,
    DealsService,
    ActivityRepository,
    ActivityService,
  ],
})
export class SalesModule {}
