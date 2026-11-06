import { Module } from '@nestjs/common';
import { TaskRepository } from '@zuko/sales';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { SalesOverviewGuard } from '../../common/auth/sales-overview.guard';
import { SalesOverviewController } from './sales-overview.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SalesOverviewController],
  providers: [
    SalesOverviewGuard,
    {
      provide: TaskRepository,
      useFactory: (prisma: PrismaService) => new TaskRepository(prisma),
      inject: [PrismaService],
    },
  ],
})
// Nest modules are declarative containers; the decorator supplies their behavior.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SalesOverviewModule {}
