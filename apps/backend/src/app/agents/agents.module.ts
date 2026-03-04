import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminService,
  OrchestratorService,
  ConnectionsRepository,
} from '@zuko/agents';
import {
  ContactsService,
  CompaniesService,
  DealsService,
  ActivityService,
  ContactsRepository,
  CompaniesRepository,
  DealsRepository,
  ActivityRepository,
} from '@zuko/sales';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: ConnectionsRepository,
      useFactory: (prismaService: PrismaService) => {
        return new ConnectionsRepository(prismaService);
      },
      inject: [PrismaService],
    },
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
    AdminService,
    {
      provide: OrchestratorService,
      useFactory: (
        adminService: AdminService,
        prismaService: PrismaService,
        contactsService: ContactsService,
        companiesService: CompaniesService,
        dealsService: DealsService,
        activityService: ActivityService,
      ) => {
        return new OrchestratorService(
          adminService,
          prismaService,
          contactsService,
          companiesService,
          dealsService,
          activityService,
        );
      },
      inject: [
        AdminService,
        PrismaService,
        ContactsService,
        CompaniesService,
        DealsService,
        ActivityService,
      ],
    },
  ],
  exports: [OrchestratorService, AdminService, ConnectionsRepository],
})
export class AgentsWrapperModule {}
