import { Module } from '@nestjs/common';
import {
  ActivitiesController,
  ContactActivitiesController,
  CompanyActivitiesController,
  DealActivitiesController,
  TaskActivitiesController,
  ProspectActivitiesController,
  LeadActivitiesController,
} from './activities.controller';
import { SalesModule } from '../sales/sales.module';
import { TasksModule } from '../tasks/tasks.module';
import { ProspectsModule } from '../prospects/prospects.module';
import { LeadsModule } from '../leads/leads.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrganizationGuard } from '../../common/auth/organization.guard';

@Module({
  imports: [
    PrismaModule,
    SalesModule,
    TasksModule,
    ProspectsModule,
    LeadsModule,
  ],
  controllers: [
    ActivitiesController,
    ContactActivitiesController,
    CompanyActivitiesController,
    DealActivitiesController,
    TaskActivitiesController,
    ProspectActivitiesController,
    LeadActivitiesController,
  ],
  providers: [OrganizationGuard],
})
export class ActivitiesModule {}
