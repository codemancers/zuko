import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { ApolloProspectsService } from './prospects/apollo-prospects.service';

@Injectable()
export class ApolloSyncService {
  private readonly logger = new Logger(ApolloSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apolloProspectsService: ApolloProspectsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async syncAllCampaignReplies() {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        providerSequenceId: { not: null },
      },
    });

    if (!campaigns.length) return;

    this.logger.log(`Syncing replies for ${campaigns.length} campaigns`);

    for (const campaign of campaigns) {
      try {
        const result = await this.apolloProspectsService.syncRepliesToLeads(
          campaign.organizationId,
          campaign.providerSequenceId!,
          campaign.icpProfileId ?? undefined,
          campaign.id,
        );
        if (result.created > 0) {
          this.logger.log(
            `Campaign ${campaign.id}: created ${result.created} leads, skipped ${result.skipped}`,
          );
        }
      } catch (err) {
        this.logger.error(
          `Campaign ${campaign.id} sync failed: ${String(err)}`,
        );
      }
    }
  }
}
