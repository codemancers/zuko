import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { HarnessGrantsService } from '../libs/eve/harness-grants.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ApolloController, RecordEnrichmentController } from './apollo.controller';
import { ApolloService } from './apollo.service';
import { KoshaClient } from './kosha.client';

@Module({
  imports: [PrismaModule, CrmModule],
  controllers: [ApolloController, RecordEnrichmentController],
  providers: [ApolloService, KoshaClient, HarnessGrantsService],
})
export class IntegrationsModule {}
