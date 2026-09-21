import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { LeadActivityListener } from './lead-activity.listener';
import type { ActivityService } from '../services/activity.service';

const LEAD_ID = 40;
const ACTOR_ID = 7;

describe('LeadActivityListener', () => {
  let listener: LeadActivityListener;
  const mockActivityService = { create: vi.fn() };

  beforeEach(() => {
    listener = new LeadActivityListener(
      mockActivityService as unknown as ActivityService,
    );
    vi.clearAllMocks();
    (mockActivityService.create as Mock).mockResolvedValue(undefined as never);
  });

  it('records lead_created for a lead entered by hand', async () => {
    await listener.handleLeadCreated({ leadId: LEAD_ID, actorId: ACTOR_ID });

    expect(mockActivityService.create).toHaveBeenCalledWith({
      activityType: 'lead_created',
      entityType: 'lead',
      entityId: LEAD_ID,
      actorId: ACTOR_ID,
      metadata: {},
    });
  });

  it('keeps the originating prospect on a lead created by promotion', async () => {
    await listener.handleLeadCreated({
      leadId: LEAD_ID,
      actorId: ACTOR_ID,
      prospectId: 30,
    });

    expect(mockActivityService.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { prospectId: 30 } }),
    );
  });

  it('records a conversion with everything it created', async () => {
    await listener.handleLeadConverted({
      leadId: LEAD_ID,
      actorId: ACTOR_ID,
      dealId: 9,
      contactId: 3,
      companyId: 5,
    });

    expect(mockActivityService.create).toHaveBeenCalledWith({
      activityType: 'lead_converted',
      entityType: 'lead',
      entityId: LEAD_ID,
      actorId: ACTOR_ID,
      metadata: { dealId: 9, contactId: 3, companyId: 5 },
    });
  });

  it('records a reversal with the deal that was removed', async () => {
    await listener.handleLeadReverted({
      leadId: LEAD_ID,
      actorId: ACTOR_ID,
      dealId: 9,
    });

    expect(mockActivityService.create).toHaveBeenCalledWith({
      activityType: 'lead_reverted',
      entityType: 'lead',
      entityId: LEAD_ID,
      actorId: ACTOR_ID,
      metadata: { dealId: 9 },
    });
  });
});
