import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeadsRepository } from '@zuko/sales';

interface ApolloWebhookEvent {
  event_type: string;
  emailer_campaign_id?: string;
  person?: {
    id?: string;
    name?: string;
    email?: string;
    title?: string;
    organization_name?: string;
    linkedin_url?: string;
    phone_numbers?: Array<{ sanitized_number?: string }>;
  };
}

@ApiExcludeController()
@Controller('integrations/apollo/webhook')
export class ApolloWebhookController {
  private readonly logger = new Logger(ApolloWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsRepository: LeadsRepository,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('x-apollo-webhook-secret') secret: string,
    @Body() event: ApolloWebhookEvent,
  ) {
    const expectedSecret = process.env['APOLLO_WEBHOOK_SECRET'];
    if (expectedSecret && secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (event.event_type !== 'email_replied') {
      return { received: true };
    }

    const { person, emailer_campaign_id } = event;
    if (!person || !emailer_campaign_id) {
      return { received: true };
    }

    const campaign = await this.prisma.campaign.findFirst({
      where: { providerSequenceId: emailer_campaign_id },
    });

    if (!campaign) {
      this.logger.warn(`No campaign found for sequence ${emailer_campaign_id}`);
      return { received: true };
    }

    const icpProfileId = campaign.icpProfileId;
    if (!icpProfileId) {
      this.logger.warn(`Campaign ${campaign.id} has no ICP profile`);
      return { received: true };
    }

    // Deduplicate by apolloPersonId
    if (person.id) {
      const existing = await this.leadsRepository.findByApolloPersonId(
        campaign.organizationId,
        person.id,
      );
      if (existing) return { received: true, leadId: existing.id };
    }

    const lead = await this.leadsRepository.create({
      organizationId: campaign.organizationId,
      icpProfileId,
      campaignId: campaign.id,
      name: person.name ?? person.email ?? 'Unknown',
      email: person.email,
      title: person.title,
      companyName: person.organization_name,
      linkedinUrl: person.linkedin_url,
      phone: person.phone_numbers?.[0]?.sanitized_number,
      apolloPersonId: person.id,
      source: 'apollo',
      status: 'replied',
    });

    this.logger.log(`Created lead ${lead.id} from Apollo webhook`);
    return { received: true, leadId: lead.id };
  }
}
