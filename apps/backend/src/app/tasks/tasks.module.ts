import { Module } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TasksController } from './tasks.controller';
import { TaskRepository, TaskService } from '@zuko/sales';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationGuard } from '../../common/auth/organization.guard';

@Module({
  imports: [PrismaModule],
  controllers: [TasksController],
  providers: [
    OrganizationGuard,
    {
      provide: TaskRepository,
      useFactory: (prismaService: PrismaService) =>
        new TaskRepository(prismaService),
      inject: [PrismaService],
    },
    {
      provide: TaskService,
      useFactory: (
        taskRepository: TaskRepository,
        eventEmitter: EventEmitter2,
      ) => new TaskService(taskRepository, eventEmitter),
      inject: [TaskRepository, EventEmitter2],
    },
  ],
})
export class TasksModule {}
