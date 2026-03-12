import { Module } from '@nestjs/common';
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
      useFactory: (taskRepository: TaskRepository) =>
        new TaskService(taskRepository),
      inject: [TaskRepository],
    },
  ],
})
export class TasksModule {}
