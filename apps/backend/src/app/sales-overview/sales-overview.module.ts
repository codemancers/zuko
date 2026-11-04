import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { SalesOverviewGuard } from '../../common/auth/sales-overview.guard';
import { SalesOverviewController } from './sales-overview.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SalesOverviewController],
  providers: [SalesOverviewGuard],
})
// Nest modules are declarative containers; the decorator supplies their behavior.
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class SalesOverviewModule {}
