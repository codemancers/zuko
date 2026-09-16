import { Module } from '@nestjs/common';
import {
  ActivitiesController,
  ContactActivitiesController,
  CompanyActivitiesController,
  DealActivitiesController,
  TaskActivitiesController,
} from './activities.controller';
import { SalesModule } from '../sales/sales.module';
import { TasksModule } from '../tasks/tasks.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrganizationGuard } from '../../common/auth/organization.guard';

@Module({
  imports: [PrismaModule, SalesModule, TasksModule],
  controllers: [
    ActivitiesController,
    ContactActivitiesController,
    CompanyActivitiesController,
    DealActivitiesController,
    TaskActivitiesController,
  ],
  providers: [OrganizationGuard],
})
export class ActivitiesModule {}
