import { Injectable, NotFoundException } from '@nestjs/common';
import { ApolloMcpService } from '../apollo-mcp.service';
import { CampaignsRepository } from '@zuko/sales';
import type {
  CreateSequenceDto,
  AddContactsToSequenceDto,
  SearchSequencesDto,
} from './dto/sequences.dto';

interface StoredTouch {
  id: string;
  emailer_template_id: string;
  type: string;
  status: string;
  include_signature: boolean;
  has_personalized_opener: boolean;
  personalized_opener_fallback_option?: string;
  generic_personalized_opener?: string;
  emailer_template?: { id: string; subject?: string; body_html: string };
}

interface SequenceStep {
  id: string;
  type: string;
  position: number;
  wait_time: number;
  wait_mode: string;
  note?: string;
  priority?: string;
  auto_skip_in_x_days?: number;
  max_emails_per_day?: number;
  emailer_touches: StoredTouch[];
}

export interface ApolloCreateResponse {
  emailer_campaign: {
    id: string;
    name: string;
    active: boolean;
    permissions: string;
  };
  emailer_steps: Array<{
    id: string;
    type: string;
    position: number;
    wait_time: number;
    wait_mode: string;
    note?: string;
    priority?: string;
    auto_skip_in_x_days?: number;
    max_emails_per_day?: number;
  }>;
  emailer_touches: Array<{
    id: string;
    emailer_step_id: string;
    emailer_template_id: string;
    type: string;
    status: string;
    include_signature: boolean;
    has_personalized_opener: boolean;
    personalized_opener_fallback_option?: string;
    generic_personalized_opener?: string;
  }>;
  emailer_templates: Array<{
    id: string;
    subject?: string;
    body_html: string;
  }>;
}

@Injectable()
export class ApolloSequencesService {
  constructor(
    private readonly apolloMcpService: ApolloMcpService,
    private readonly campaignsRepository: CampaignsRepository,
  ) {}

  async searchSequences(organizationId: number, dto: SearchSequencesDto) {
    return this.apolloMcpService.callTool(
      organizationId,
      'apollo_emailer_campaigns_search',
      {
        _conversation_ref: `zuko_${organizationId}`,
        _rationale: 'User searching sequences from Zuko',
        q_name: dto.name,
        q_active: false, // include inactive sequences
        page: dto.page?.toString(),
        per_page: dto.perPage?.toString(),
      },
    );
  }

  async getSchedules(organizationId: number) {
    try {
      return await this.apolloMcpService.callTool(
        organizationId,
        'apollo_emailer_schedules_index',
        {
          _conversation_ref: `zuko_${organizationId}`,
          _rationale: 'User fetching sending schedules from Zuko',
        },
      );
    } catch {
      return { emailer_schedules: [] };
    }
  }

  async createSequence(
    organizationId: number,
    userId: number,
    dto: CreateSequenceDto,
  ) {
    const result = await this.apolloMcpService.callTool<ApolloCreateResponse>(
      organizationId,
      'apollo_sequences_create',
      {
        _conversation_ref: `zuko_${organizationId}`,
        _rationale: 'User creating sequence from Zuko',
        name: dto.name,
        active: false,
        permissions: dto.permissions ?? 'team_can_use',
        ...(dto.emailerScheduleId && {
          emailer_schedule_id: dto.emailerScheduleId,
        }),
        ...(dto.labelNames?.length && { label_names: dto.labelNames }),
        emailer_steps: dto.sequence.map((step, index) => ({
          type: step.type,
          position: index + 1,
          wait_time: step.waitTime,
          wait_mode: step.waitMode ?? 'day',
          ...(step.note && { note: step.note }),
          ...(step.priority && { priority: step.priority }),
          ...(step.autoSkipInXDays && {
            auto_skip_in_x_days: step.autoSkipInXDays,
          }),
          ...(step.maxEmailsPerDay && {
            max_emails_per_day: step.maxEmailsPerDay,
          }),
          emailer_touches: step.touches.map((touch) => ({
            type: touch.type,
            status: touch.status ?? 'approved',
            include_signature: touch.includeSignature ?? true,
            has_personalized_opener: touch.hasPersonalizedOpener ?? false,
            ...(touch.hasPersonalizedOpener && {
              personalized_opener_fallback_option:
                touch.personalizedOpenerFallbackOption ?? 'skip',
              ...(touch.genericPersonalizedOpener && {
                generic_personalized_opener: touch.genericPersonalizedOpener,
              }),
            }),
            emailer_template: {
              subject: touch.emailerTemplate.subject ?? '',
              body_html: touch.emailerTemplate.bodyHtml,
              creation_type: 'manual',
            },
          })),
        })),
      },
    );

    // Persist the full Apollo response so we have step + touch + template IDs for future updates
    // Guard against MCP responses that omit emailer_campaign (e.g. when Apollo returns partial data)
    if (result?.emailer_campaign?.id) {
      const sequence = this.buildSequenceSteps(result);
      await this.campaignsRepository.upsert({
        organizationId,
        createdById: userId,
        name: result.emailer_campaign.name ?? dto.name,
        providerSequenceId: result.emailer_campaign.id,
        active: result.emailer_campaign.active ?? false,
        permissions: result.emailer_campaign.permissions ?? dto.permissions ?? 'team_can_use',
        sequence,
      });
    }

    return result;
  }

  async updateSequence(
    organizationId: number,
    sequenceId: string,
    userId: number,
    dto: CreateSequenceDto,
  ) {
    const campaign = await this.campaignsRepository.findBySequenceId(
      organizationId,
      sequenceId,
    );
    const wasInactive = campaign ? !campaign.active : true;

    const result = await this.apolloMcpService.callTool<ApolloCreateResponse>(
      organizationId,
      'apollo_sequences_update',
      {
        _conversation_ref: `zuko_${organizationId}`,
        _rationale: 'User updating sequence from Zuko',
        id: sequenceId,
        active: true, // required MCP workaround for inactive sequences
        ...(dto.name && { name: dto.name }),
        permissions: dto.permissions ?? 'team_can_use',
        ...(dto.emailerScheduleId && {
          emailer_schedule_id: dto.emailerScheduleId,
        }),
        ...(dto.labelNames?.length && { label_names: dto.labelNames }),
        emailer_steps: dto.sequence.map((step, index) => ({
          ...(step.apolloStepId && { id: step.apolloStepId }),
          type: step.type,
          position: index + 1,
          wait_time: step.waitTime,
          wait_mode: step.waitMode ?? 'day',
          ...(step.note && { note: step.note }),
          ...(step.priority && { priority: step.priority }),
          ...(step.autoSkipInXDays && {
            auto_skip_in_x_days: step.autoSkipInXDays,
          }),
          ...(step.maxEmailsPerDay && {
            max_emails_per_day: step.maxEmailsPerDay,
          }),
          emailer_touches: step.touches.map((touch) => ({
            ...(touch.apolloTouchId && { id: touch.apolloTouchId }),
            type: touch.type,
            status: touch.status ?? 'approved',
            include_signature: touch.includeSignature ?? true,
            has_personalized_opener: touch.hasPersonalizedOpener ?? false,
            ...(touch.hasPersonalizedOpener && {
              personalized_opener_fallback_option:
                touch.personalizedOpenerFallbackOption ?? 'skip',
              ...(touch.genericPersonalizedOpener && {
                generic_personalized_opener: touch.genericPersonalizedOpener,
              }),
            }),
            emailer_template: {
              ...(touch.apolloTemplateId && { id: touch.apolloTemplateId }),
              subject: touch.emailerTemplate.subject ?? '',
              body_html: touch.emailerTemplate.bodyHtml,
              creation_type: 'manual',
            },
          })),
        })),
      },
    );

    // Persist updated steps with new Apollo IDs
    const sequence = this.buildSequenceSteps(result);
    await this.campaignsRepository.upsert({
      organizationId,
      createdById: userId,
      name: dto.name,
      providerSequenceId: sequenceId,
      active: !wasInactive,
      permissions: dto.permissions ?? 'team_can_use',
      sequence,
    });

    // Re-deactivate if it was inactive before update
    if (wasInactive) {
      await this.deactivateSequence(organizationId, sequenceId);
    }

    return result;
  }

  async approveSequence(organizationId: number, sequenceId: string) {
    const result = await this.apolloMcpService.callTool(
      organizationId,
      'apollo_emailer_campaigns_approve',
      {
        _conversation_ref: `zuko_${organizationId}`,
        _rationale: 'User activating sequence from Zuko',
        id: sequenceId,
      },
    );
    await this.campaignsRepository
      .updateActive(organizationId, sequenceId, true)
      .catch(() => {});
    return result;
  }

  async deactivateSequence(organizationId: number, sequenceId: string) {
    const campaign = await this.campaignsRepository.findBySequenceId(
      organizationId,
      sequenceId,
    );

    if (!campaign) {
      throw new NotFoundException(
        'Campaign not found in Zuko. Create it via Zuko to enable deactivation.',
      );
    }

    const sequence = campaign.sequence as unknown[];
    if (!sequence || sequence.length === 0) {
      throw new NotFoundException(
        'No steps stored for this campaign. Recreate it via Zuko to enable deactivation.',
      );
    }

    const result = await this.apolloMcpService.callTool(
      organizationId,
      'apollo_sequences_update',
      {
        _conversation_ref: `zuko_${organizationId}`,
        _rationale: 'User deactivating sequence from Zuko',
        id: sequenceId,
        active: false,
        emailer_steps: this.formatSequenceForMcp(sequence as SequenceStep[]),
      },
    );

    await this.campaignsRepository
      .updateActive(organizationId, sequenceId, false)
      .catch(() => {});
    return result;
  }

  async getCampaign(organizationId: number, sequenceId: string) {
    const campaign = await this.campaignsRepository.findBySequenceId(
      organizationId,
      sequenceId,
    );
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async addContactsToSequence(
    organizationId: number,
    dto: AddContactsToSequenceDto,
  ) {
    return this.apolloMcpService.callTool(
      organizationId,
      'apollo_emailer_campaigns_add_contact_ids',
      {
        _conversation_ref: `zuko_${organizationId}`,
        _rationale: 'User enrolling contacts into sequence from Zuko',
        id: dto.sequenceId,
        contact_ids: dto.contactIds,
      },
    );
  }

  // Strips stored steps down to exactly what Apollo MCP sequences_update accepts
  private formatSequenceForMcp(sequence: SequenceStep[]) {
    return sequence.map((step) => ({
      id: step.id,
      type: step.type,
      position: step.position,
      wait_time: step.wait_time,
      wait_mode: step.wait_mode,
      ...(step.note && { note: step.note }),
      ...(step.priority && { priority: step.priority }),
      ...(step.auto_skip_in_x_days && {
        auto_skip_in_x_days: step.auto_skip_in_x_days,
      }),
      ...(step.max_emails_per_day && {
        max_emails_per_day: step.max_emails_per_day,
      }),
      emailer_touches: step.emailer_touches.map((touch) => ({
        id: touch.id,
        type: touch.type,
        status: touch.status,
        include_signature: touch.include_signature,
        ...(touch.has_personalized_opener && {
          has_personalized_opener: true,
          personalized_opener_fallback_option:
            touch.personalized_opener_fallback_option,
          ...(touch.generic_personalized_opener && {
            generic_personalized_opener: touch.generic_personalized_opener,
          }),
        }),
        emailer_template: touch.emailer_template
          ? {
              id: touch.emailer_template.id,
              subject: touch.emailer_template.subject,
              body_html: touch.emailer_template.body_html,
              creation_type: 'manual',
            }
          : undefined,
      })),
    }));
  }

  // Builds the step payload to store in DB — includes Apollo step/touch/template IDs
  private buildSequenceSteps(result: ApolloCreateResponse) {
    return (result.emailer_steps ?? []).map((step) => {
      const touches = (result.emailer_touches ?? [])
        .filter((t) => t.emailer_step_id === step.id)
        .map((touch) => {
          const template = (result.emailer_templates ?? []).find(
            (t) => t.id === touch.emailer_template_id,
          );
          return {
            id: touch.id,
            emailer_template_id: touch.emailer_template_id,
            type: touch.type,
            status: touch.status,
            include_signature: touch.include_signature,
            has_personalized_opener: touch.has_personalized_opener,
            personalized_opener_fallback_option:
              touch.personalized_opener_fallback_option,
            generic_personalized_opener: touch.generic_personalized_opener,
            emailer_template: template
              ? {
                  id: template.id,
                  subject: template.subject,
                  body_html: template.body_html,
                }
              : undefined,
          };
        });

      return {
        id: step.id,
        type: step.type,
        position: step.position,
        wait_time: step.wait_time,
        wait_mode: step.wait_mode,
        note: step.note,
        priority: step.priority,
        auto_skip_in_x_days: step.auto_skip_in_x_days,
        max_emails_per_day: step.max_emails_per_day,
        emailer_touches: touches,
      };
    });
  }
}
