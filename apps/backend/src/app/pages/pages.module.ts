import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { OrganizationGuard } from '../../common/auth/organization.guard';

import { PagesController } from './pages.controller';
import { PagesRepository } from './pages.repository';
import { PagesService } from './pages.service';

@Module({
  imports: [PrismaModule],
  controllers: [PagesController],
  providers: [OrganizationGuard, PagesService, PagesRepository],
  exports: [PagesService],
})
export class PagesModule {}
