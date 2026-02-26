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
  ActivityService,
  ContactsRepository,
  CompaniesRepository,
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
        activityService: ActivityService,
      ) => {
        return new OrchestratorService(
          adminService,
          prismaService,
          contactsService,
          companiesService,
          activityService,
        );
      },
      inject: [
        AdminService,
        PrismaService,
        ContactsService,
        CompaniesService,
        ActivityService,
      ],
    },
  ],
  exports: [OrchestratorService, AdminService, ConnectionsRepository],
})
export class AgentsWrapperModule {}
