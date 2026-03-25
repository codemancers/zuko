import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ContactsRepository } from '../repositories/contacts.repository';
import { ContactsService } from '../services/contacts.service';
import { CompaniesRepository } from '../repositories/companies.repository';
import { CompaniesService } from '../services/companies.service';
import { DealsRepository } from '../repositories/deals.repository';
import { DealsService } from '../services/deals.service';
import { ActivityRepository } from '../repositories/activity.repository';
import { ActivityService } from '../services/activity.service';
import { DealActivityListener } from '../listeners/deal-activity.listener';
import { ContactActivityListener } from '../listeners/contact-activity.listener';
import { CompanyActivityListener } from '../listeners/company-activity.listener';
import { TaskActivityListener } from '../listeners/task-activity.listener';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [
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
    TaskActivityListener,
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
    DealActivityListener,
    ContactActivityListener,
    CompanyActivityListener,
    TaskActivityListener,
  ],
})
export class SalesModule {}
