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
  // Apollo sends `event` or `event_type` depending on version
  event?: string;
  event_type?: string;
  emailer_campaign_id?: string;
  // Apollo sends contact data in `data.contact` or top-level `person`
  data?: {
    contact?: ApolloContactPayload;
    sequence_id?: string;
    contact_id?: string;
  };
  person?: ApolloContactPayload;
}

interface ApolloContactPayload {
  id?: string;
  name?: string;
  email?: string;
  title?: string;
  organization_name?: string;
  organization?: { name?: string };
  linkedin_url?: string;
  phone_numbers?: Array<{ sanitized_number?: string }>;
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

    const eventType = event.event ?? event.event_type ?? '';
    if (eventType !== 'email_replied' && eventType !== 'email.replied') {
      return { received: true };
    }

    // Support both payload shapes: Apollo v1 (person) and v2 (data.contact)
    const person = event.person ?? event.data?.contact;
    const emailer_campaign_id =
      event.emailer_campaign_id ?? event.data?.sequence_id;
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
      companyName: person.organization_name ?? person.organization?.name,
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
