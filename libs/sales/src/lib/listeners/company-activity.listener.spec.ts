import { describe, it, expect, beforeEach, type Mock } from 'vitest';
import { CompanyActivityListener } from './company-activity.listener';
import type { ActivityService } from '../services/activity.service';

const COMPANY_ID = 30;
const ACTOR_ID = 7;

describe('CompanyActivityListener', () => {
  let listener: CompanyActivityListener;
  const mockActivityService = { create: vi.fn() };

  beforeEach(() => {
    listener = new CompanyActivityListener(
      mockActivityService as unknown as ActivityService,
    );
    vi.clearAllMocks();
    (mockActivityService.create as Mock).mockResolvedValue(undefined as never);
  });

  describe('handleCompanyCreated', () => {
    it('calls activityService.create with company_created', async () => {
      await listener.handleCompanyCreated({
        companyId: COMPANY_ID,
        actorId: ACTOR_ID,
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'company_created',
        entityType: 'company',
        entityId: COMPANY_ID,
        actorId: ACTOR_ID,
        metadata: {},
      });
    });

    it('includes source in metadata when source is provided', async () => {
      await listener.handleCompanyCreated({
        companyId: COMPANY_ID,
        actorId: ACTOR_ID,
        source: 'ai',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ source: 'ai' }),
        }),
      );
    });
  });

  describe('handleFieldUpdated', () => {
    it('calls activityService.create with field_update', async () => {
      await listener.handleFieldUpdated({
        companyId: COMPANY_ID,
        actorId: ACTOR_ID,
        field: 'website',
        from: 'https://old.com',
        to: 'https://new.com',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'field_update',
        entityType: 'company',
        entityId: COMPANY_ID,
        actorId: ACTOR_ID,
        metadata: {
          field: 'website',
          from: 'https://old.com',
          to: 'https://new.com',
        },
      });
    });
  });

  describe('handleOwnerAssigned', () => {
    it('calls activityService.create with owner_assigned', async () => {
      await listener.handleOwnerAssigned({
        companyId: COMPANY_ID,
        actorId: ACTOR_ID,
        userId: 3,
        userName: 'Dave',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'owner_assigned',
        entityType: 'company',
        entityId: COMPANY_ID,
        actorId: ACTOR_ID,
        metadata: { userId: 3, userName: 'Dave' },
      });
    });
  });

  describe('handleOwnerRemoved', () => {
    it('calls activityService.create with owner_removed', async () => {
      await listener.handleOwnerRemoved({
        companyId: COMPANY_ID,
        actorId: ACTOR_ID,
        userId: 3,
        userName: 'Dave',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'owner_removed',
        entityType: 'company',
        entityId: COMPANY_ID,
        actorId: ACTOR_ID,
        metadata: { userId: 3, userName: 'Dave' },
      });
    });
  });

  describe('handleContactLinked', () => {
    it('calls activityService.create with contact_linked', async () => {
      await listener.handleContactLinked({
        companyId: COMPANY_ID,
        actorId: ACTOR_ID,
        contactId: 11,
        contactName: 'Eve',
        role: 'Engineer',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'contact_linked',
        entityType: 'company',
        entityId: COMPANY_ID,
        actorId: ACTOR_ID,
        metadata: { contactId: 11, contactName: 'Eve', role: 'Engineer' },
      });
    });

    it('omits role from metadata when not provided', async () => {
      await listener.handleContactLinked({
        companyId: COMPANY_ID,
        actorId: ACTOR_ID,
        contactId: 11,
        contactName: 'Eve',
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
        companyId: COMPANY_ID,
        actorId: ACTOR_ID,
        contactId: 11,
        contactName: 'Eve',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'contact_unlinked',
        entityType: 'company',
        entityId: COMPANY_ID,
        actorId: ACTOR_ID,
        metadata: { contactId: 11, contactName: 'Eve' },
      });
    });
  });
});
