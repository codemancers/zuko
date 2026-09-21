import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { ProspectActivityListener } from './prospect-activity.listener';
import type { ActivityService } from '../services/activity.service';

const PROSPECT_ID = 30;
const ACTOR_ID = 7;

describe('ProspectActivityListener', () => {
  let listener: ProspectActivityListener;
  const mockActivityService = { create: vi.fn() };

  beforeEach(() => {
    listener = new ProspectActivityListener(
      mockActivityService as unknown as ActivityService,
    );
    vi.clearAllMocks();
    (mockActivityService.create as Mock).mockResolvedValue(undefined as never);
  });

  it('records prospect_created', async () => {
    await listener.handleProspectCreated({
      prospectId: PROSPECT_ID,
      actorId: ACTOR_ID,
    });

    expect(mockActivityService.create).toHaveBeenCalledWith({
      activityType: 'prospect_created',
      entityType: 'prospect',
      entityId: PROSPECT_ID,
      actorId: ACTOR_ID,
      metadata: {},
    });
  });

  it('includes source in metadata when the change came from an agent', async () => {
    await listener.handleProspectCreated({
      prospectId: PROSPECT_ID,
      actorId: ACTOR_ID,
      source: 'ai',
    });

    expect(mockActivityService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ source: 'ai' }),
      }),
    );
  });

  it('records a status change with both ends of the transition', async () => {
    await listener.handleStatusChanged({
      prospectId: PROSPECT_ID,
      actorId: ACTOR_ID,
      from: 'new',
      to: 'enrolled',
    });

    expect(mockActivityService.create).toHaveBeenCalledWith({
      activityType: 'prospect_status_changed',
      entityType: 'prospect',
      entityId: PROSPECT_ID,
      actorId: ACTOR_ID,
      metadata: { from: 'new', to: 'enrolled' },
    });
  });

  it('records an enrolment with its campaign and channel', async () => {
    await listener.handleEnrolled({
      prospectId: PROSPECT_ID,
      actorId: ACTOR_ID,
      campaignId: 4,
      channel: 'email',
    });

    expect(mockActivityService.create).toHaveBeenCalledWith({
      activityType: 'prospect_enrolled',
      entityType: 'prospect',
      entityId: PROSPECT_ID,
      actorId: ACTOR_ID,
      metadata: { campaignId: 4, channel: 'email' },
    });
  });

  it('records a promotion with the lead it produced', async () => {
    await listener.handlePromoted({
      prospectId: PROSPECT_ID,
      actorId: ACTOR_ID,
      leadId: 88,
    });

    expect(mockActivityService.create).toHaveBeenCalledWith({
      activityType: 'prospect_promoted',
      entityType: 'prospect',
      entityId: PROSPECT_ID,
      actorId: ACTOR_ID,
      metadata: { leadId: 88 },
    });
  });

  it('records a demotion with the lead it reversed', async () => {
    await listener.handleDemoted({
      prospectId: PROSPECT_ID,
      actorId: ACTOR_ID,
      leadId: 88,
    });

    expect(mockActivityService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: 'prospect_demoted',
        metadata: { leadId: 88 },
      }),
    );
  });

  it('records a consent change per channel', async () => {
    await listener.handleConsentChanged({
      prospectId: PROSPECT_ID,
      actorId: ACTOR_ID,
      channel: 'email',
      from: 'unknown',
      to: 'revoked',
    });

    expect(mockActivityService.create).toHaveBeenCalledWith({
      activityType: 'prospect_consent_changed',
      entityType: 'prospect',
      entityId: PROSPECT_ID,
      actorId: ACTOR_ID,
      metadata: { channel: 'email', from: 'unknown', to: 'revoked' },
    });
  });

  it('records suppression', async () => {
    await listener.handleSuppressed({
      prospectId: PROSPECT_ID,
      actorId: ACTOR_ID,
    });

    expect(mockActivityService.create).toHaveBeenCalledWith({
      activityType: 'prospect_suppressed',
      entityType: 'prospect',
      entityId: PROSPECT_ID,
      actorId: ACTOR_ID,
      metadata: {},
    });
  });
});
