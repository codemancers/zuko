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
  AccountsService,
  ActivityService,
  ContactsRepository,
  AccountsRepository,
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
    AdminService,
    {
      provide: OrchestratorService,
      useFactory: (
        adminService: AdminService,
        prismaService: PrismaService,
        contactsService: ContactsService,
        accountsService: AccountsService,
        activityService: ActivityService
      ) => {
        return new OrchestratorService(
          adminService,
          prismaService,
          contactsService,
          accountsService,
          activityService
        );
      },
      inject: [AdminService, PrismaService, ContactsService, AccountsService, ActivityService],
    },
  ],
  exports: [
    OrchestratorService,
    AdminService,
    ConnectionsRepository,
  ],
})
export class AgentsWrapperModule {}
