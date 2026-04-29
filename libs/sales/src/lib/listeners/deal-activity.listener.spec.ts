import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { DealActivityListener } from './deal-activity.listener';
import type { ActivityService } from '../services/activity.service';

const DEAL_ID = 10;
const ACTOR_ID = 42;

describe('DealActivityListener', () => {
  let listener: DealActivityListener;
  const mockActivityService = { create: vi.fn() };

  beforeEach(() => {
    listener = new DealActivityListener(
      mockActivityService as unknown as ActivityService,
    );
    vi.clearAllMocks();
    (mockActivityService.create as Mock).mockResolvedValue(undefined as never);
  });

  describe('handleDealCreated', () => {
    it('calls activityService.create with deal_created', async () => {
      await listener.handleDealCreated({ dealId: DEAL_ID, actorId: ACTOR_ID });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'deal_created',
        entityType: 'deal',
        entityId: DEAL_ID,
        actorId: ACTOR_ID,
        metadata: {},
      });
    });
  });

  describe('handleStageChanged', () => {
    it('calls activityService.create with stage_change', async () => {
      await listener.handleStageChanged({
        dealId: DEAL_ID,
        actorId: ACTOR_ID,
        from: 'prospecting',
        to: 'qualification',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'stage_change',
        entityType: 'deal',
        entityId: DEAL_ID,
        actorId: ACTOR_ID,
        metadata: { from: 'prospecting', to: 'qualification' },
      });
    });
  });

  describe('handleDealClosed', () => {
    it('calls activityService.create with deal_closed outcome=won', async () => {
      await listener.handleDealClosed({
        dealId: DEAL_ID,
        actorId: ACTOR_ID,
        outcome: 'won',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'deal_closed',
        entityType: 'deal',
        entityId: DEAL_ID,
        actorId: ACTOR_ID,
        metadata: { outcome: 'won', lostReason: undefined },
      });
    });

    it('calls activityService.create with deal_closed outcome=lost and lostReason', async () => {
      await listener.handleDealClosed({
        dealId: DEAL_ID,
        actorId: ACTOR_ID,
        outcome: 'lost',
        lostReason: 'Price',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'deal_closed',
        entityType: 'deal',
        entityId: DEAL_ID,
        actorId: ACTOR_ID,
        metadata: { outcome: 'lost', lostReason: 'Price' },
      });
    });
  });

  describe('handleFieldUpdated', () => {
    it('calls activityService.create with field_update', async () => {
      await listener.handleFieldUpdated({
        dealId: DEAL_ID,
        actorId: ACTOR_ID,
        field: 'value',
        from: 5000,
        to: 9999,
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'field_update',
        entityType: 'deal',
        entityId: DEAL_ID,
        actorId: ACTOR_ID,
        metadata: { field: 'value', from: 5000, to: 9999 },
      });
    });
  });

  describe('handleOwnerAssigned', () => {
    it('calls activityService.create with owner_assigned', async () => {
      await listener.handleOwnerAssigned({
        dealId: DEAL_ID,
        actorId: ACTOR_ID,
        userId: 3,
        userName: 'Bob',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'owner_assigned',
        entityType: 'deal',
        entityId: DEAL_ID,
        actorId: ACTOR_ID,
        metadata: { userId: 3, userName: 'Bob' },
      });
    });
  });

  describe('handleOwnerRemoved', () => {
    it('calls activityService.create with owner_removed', async () => {
      await listener.handleOwnerRemoved({
        dealId: DEAL_ID,
        actorId: ACTOR_ID,
        userId: 3,
        userName: 'Bob',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'owner_removed',
        entityType: 'deal',
        entityId: DEAL_ID,
        actorId: ACTOR_ID,
        metadata: { userId: 3, userName: 'Bob' },
      });
    });
  });

  describe('handleCompanyLinked', () => {
    it('calls activityService.create with company_linked', async () => {
      await listener.handleCompanyLinked({
        dealId: DEAL_ID,
        actorId: ACTOR_ID,
        companyId: 5,
        companyName: 'Acme Corp',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'company_linked',
        entityType: 'deal',
        entityId: DEAL_ID,
        actorId: ACTOR_ID,
        metadata: { companyId: 5, companyName: 'Acme Corp' },
      });
    });
  });

  describe('handleCompanyUnlinked', () => {
    it('calls activityService.create with company_unlinked', async () => {
      await listener.handleCompanyUnlinked({
        dealId: DEAL_ID,
        actorId: ACTOR_ID,
        companyId: 5,
        companyName: 'Acme Corp',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'company_unlinked',
        entityType: 'deal',
        entityId: DEAL_ID,
        actorId: ACTOR_ID,
        metadata: { companyId: 5, companyName: 'Acme Corp' },
      });
    });
  });

  describe('handleContactLinked', () => {
    it('calls activityService.create with contact_linked including role', async () => {
      await listener.handleContactLinked({
        dealId: DEAL_ID,
        actorId: ACTOR_ID,
        contactId: 7,
        contactName: 'Jane Smith',
        role: 'Decision Maker',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'contact_linked',
        entityType: 'deal',
        entityId: DEAL_ID,
        actorId: ACTOR_ID,
        metadata: {
          contactId: 7,
          contactName: 'Jane Smith',
          role: 'Decision Maker',
        },
      });
    });

    it('omits role from metadata when not provided', async () => {
      await listener.handleContactLinked({
        dealId: DEAL_ID,
        actorId: ACTOR_ID,
        contactId: 7,
        contactName: 'Jane Smith',
      });

      const call = (mockActivityService.create as Mock).mock.calls[0] as [
        { metadata: Record<string, unknown> },
      ];
      expect(call[0].metadata).not.toHaveProperty('role');
    });
  });

  describe('handleContactUnlinked', () => {
    it('calls activityService.create with contact_unlinked', async () => {
      await listener.handleContactUnlinked({
        dealId: DEAL_ID,
        actorId: ACTOR_ID,
        contactId: 7,
        contactName: 'Jane Smith',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'contact_unlinked',
        entityType: 'deal',
        entityId: DEAL_ID,
        actorId: ACTOR_ID,
        metadata: { contactId: 7, contactName: 'Jane Smith' },
      });
    });
  });
});
