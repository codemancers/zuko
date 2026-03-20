import { Module } from '@nestjs/common';
import { AgentGuard } from '../../common/auth/agent.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentsController } from './agents.controller';
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
  controllers: [AgentsController],
  providers: [AgentGuard,
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
  ],
})
export class AgentsWrapperModule {}
