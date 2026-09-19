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
  async syncAllCampaignActivity() {
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        externalId: { not: null },
      },
    });

    if (!campaigns.length) return;

    this.logger.log(`Syncing activity for ${campaigns.length} campaigns`);

    for (const campaign of campaigns) {
      try {
        const result = await this.apolloProspectsService.syncSequenceActivity(
          campaign.organizationId,
          campaign.externalId!,
          campaign.icpProfileId ?? undefined,
          campaign.id,
        );
        if (result.prospects > 0 || result.touches > 0) {
          this.logger.log(
            `Campaign ${campaign.id}: ${result.prospects} prospects, ` +
              `${result.enrolled} enrolled, ${result.touches} touches, ` +
              `${result.skipped} skipped`,
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
