import { describe, it, expect, beforeEach } from 'vitest';
import { ContactActivityListener } from './contact-activity.listener';
import { ActivityService } from '../services/activity.service';

const CONTACT_ID = 20;
const ACTOR_ID = 5;

describe('ContactActivityListener', () => {
  let listener: ContactActivityListener;
  const mockActivityService = { create: vi.fn() };

  beforeEach(() => {
    listener = new ContactActivityListener(
      mockActivityService as unknown as ActivityService,
    );
    vi.clearAllMocks();
    (mockActivityService.create as vi.Mock).mockResolvedValue(undefined as never);
  });

  describe('handleContactCreated', () => {
    it('calls activityService.create with contact_created', async () => {
      await listener.handleContactCreated({ contactId: CONTACT_ID, actorId: ACTOR_ID });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'contact_created',
        entityType: 'contact',
        entityId: CONTACT_ID,
        actorId: ACTOR_ID,
        metadata: {},
      });
    });

    it('includes source in metadata when source is provided', async () => {
      await listener.handleContactCreated({ contactId: CONTACT_ID, actorId: ACTOR_ID, source: 'ai' });

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
        contactId: CONTACT_ID,
        actorId: ACTOR_ID,
        field: 'email',
        from: 'old@example.com',
        to: 'new@example.com',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'field_update',
        entityType: 'contact',
        entityId: CONTACT_ID,
        actorId: ACTOR_ID,
        metadata: { field: 'email', from: 'old@example.com', to: 'new@example.com' },
      });
    });
  });

  describe('handleOwnerAssigned', () => {
    it('calls activityService.create with owner_assigned', async () => {
      await listener.handleOwnerAssigned({
        contactId: CONTACT_ID,
        actorId: ACTOR_ID,
        userId: 9,
        userName: 'Carol',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'owner_assigned',
        entityType: 'contact',
        entityId: CONTACT_ID,
        actorId: ACTOR_ID,
        metadata: { userId: 9, userName: 'Carol' },
      });
    });
  });

  describe('handleOwnerRemoved', () => {
    it('calls activityService.create with owner_removed', async () => {
      await listener.handleOwnerRemoved({
        contactId: CONTACT_ID,
        actorId: ACTOR_ID,
        userId: 9,
        userName: 'Carol',
      });

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'owner_removed',
        entityType: 'contact',
        entityId: CONTACT_ID,
        actorId: ACTOR_ID,
        metadata: { userId: 9, userName: 'Carol' },
      });
    });
  });
});
