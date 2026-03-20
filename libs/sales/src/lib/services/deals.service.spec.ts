import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DealsService } from './deals.service';
import { DealsRepository } from '../repositories/deals.repository';
import { ActivityService } from './activity.service';

const ORG_ID = 1;
const ACTOR_ID = 42;

const mockDeal = {
  id: 10,
  title: 'Test Deal',
  stage: 'prospecting',
  value: 5000,
  probability: 50,
  priority: 2,
  expectedCloseDate: null,
  actualCloseDate: null,
  lostReason: null,
  organizationId: ORG_ID,
  owners: [],
  companies: [],
  contacts: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('DealsService - activity events', () => {
  let service: DealsService;

  const mockRepo = {
    create: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    hide: jest.fn(),
    unhide: jest.fn(),
    findAll: jest.fn(),
    addOwner: jest.fn(),
    removeOwner: jest.fn(),
    setPrimaryOwner: jest.fn(),
    getDealsByOwner: jest.fn(),
    addCompany: jest.fn(),
    removeCompany: jest.fn(),
    updateCompany: jest.fn(),
    getCompanies: jest.fn(),
    addContact: jest.fn(),
    removeContact: jest.fn(),
    updateContact: jest.fn(),
    getContacts: jest.fn(),
    getDealsByCompany: jest.fn(),
    getDealsByContact: jest.fn(),
  };

  const mockActivityService = {
    create: jest.fn(),
  };

  beforeEach(() => {
    service = new DealsService(
      mockRepo as unknown as DealsRepository,
      mockActivityService as unknown as ActivityService,
    );
    jest.clearAllMocks();
    // Default: findById returns the mock deal
    (mockRepo.findById as jest.Mock).mockResolvedValue(mockDeal as never);
  });

  // ── deal_created ──────────────────────────────────────────────────────────

  describe('create', () => {
    it('logs deal_created event after deal is created', async () => {
      (mockRepo.create as jest.Mock).mockResolvedValue(mockDeal as never);
      (mockActivityService.create as jest.Mock).mockResolvedValue(undefined as never);

      await service.create(
        { title: 'Test Deal', ownerIds: [1] },
        ACTOR_ID,
      );

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'deal_created',
        entityType: 'deal',
        entityId: mockDeal.id,
        actorId: ACTOR_ID,
        metadata: {},
      });
    });

    it('does not log event when repo.create throws', async () => {
      (mockRepo.create as jest.Mock).mockRejectedValue(new Error('DB error') as never);

      await expect(
        service.create({ title: 'Test Deal', ownerIds: [1] }),
      ).rejects.toThrow('DB error');

      expect(mockActivityService.create).not.toHaveBeenCalled();
    });
  });

  // ── stage_change ──────────────────────────────────────────────────────────

  describe('update - stage_change', () => {
    it('logs stage_change when stage differs from existing', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        stage: 'qualification',
      } as never);

      await service.update(mockDeal.id, ORG_ID, { stage: 'qualification' }, ACTOR_ID);

      expect(mockActivityService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          activityType: 'stage_change',
          entityType: 'deal',
          entityId: mockDeal.id,
          actorId: ACTOR_ID,
          metadata: { from: 'prospecting', to: 'qualification' },
        }),
      );
    });

    it('does not log stage_change when stage is unchanged', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue(mockDeal as never);

      await service.update(
        mockDeal.id,
        ORG_ID,
        { stage: 'prospecting' },
        ACTOR_ID,
      );

      const calls = (mockActivityService.create as jest.Mock).mock.calls as Array<
        [{ activityType: string }]
      >;
      const stageChangeCalls = calls.filter(
        ([arg]) => arg.activityType === 'stage_change',
      );
      expect(stageChangeCalls).toHaveLength(0);
    });
  });

  // ── deal_closed ───────────────────────────────────────────────────────────

  describe('update - deal_closed', () => {
    it('logs deal_closed with outcome=won when actualCloseDate set and stage is closed_won', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        stage: 'closed_won',
        actualCloseDate: new Date(),
      } as never);

      await service.update(
        mockDeal.id,
        ORG_ID,
        { stage: 'closed_won', actualCloseDate: new Date() },
        ACTOR_ID,
      );

      expect(mockActivityService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          activityType: 'deal_closed',
          metadata: expect.objectContaining({ outcome: 'won' }),
        }),
      );
    });

    it('logs deal_closed with outcome=lost when stage is closed_lost', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        stage: 'closed_lost',
        actualCloseDate: new Date(),
      } as never);

      await service.update(
        mockDeal.id,
        ORG_ID,
        { stage: 'closed_lost', actualCloseDate: new Date(), lostReason: 'Price' },
        ACTOR_ID,
      );

      expect(mockActivityService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          activityType: 'deal_closed',
          metadata: expect.objectContaining({ outcome: 'lost', lostReason: 'Price' }),
        }),
      );
    });

    it('does not log deal_closed when actualCloseDate was already set', async () => {
      const dealAlreadyClosed = { ...mockDeal, actualCloseDate: new Date() };
      (mockRepo.findById as jest.Mock).mockResolvedValue(dealAlreadyClosed as never);
      (mockRepo.update as jest.Mock).mockResolvedValue(dealAlreadyClosed as never);

      await service.update(
        mockDeal.id,
        ORG_ID,
        { actualCloseDate: new Date() },
        ACTOR_ID,
      );

      const calls = (mockActivityService.create as jest.Mock).mock.calls as Array<
        [{ activityType: string }]
      >;
      expect(calls.some(([a]) => a.activityType === 'deal_closed')).toBe(false);
    });
  });

  // ── field_update ──────────────────────────────────────────────────────────

  describe('update - field_update', () => {
    it('logs field_update for each changed tracked field', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        value: 9999,
        probability: 80,
      } as never);

      await service.update(
        mockDeal.id,
        ORG_ID,
        { value: 9999, probability: 80 },
        ACTOR_ID,
      );

      const calls = (mockActivityService.create as jest.Mock).mock.calls as Array<
        [{ activityType: string; metadata: Record<string, unknown> }]
      >;
      const fieldUpdates = calls
        .filter(([a]) => a.activityType === 'field_update')
        .map(([a]) => a.metadata.field);

      expect(fieldUpdates).toContain('value');
      expect(fieldUpdates).toContain('probability');
    });

    it('does not log field_update when value is unchanged', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue(mockDeal as never);

      await service.update(mockDeal.id, ORG_ID, { value: 5000 }, ACTOR_ID);

      const calls = (mockActivityService.create as jest.Mock).mock.calls as Array<
        [{ activityType: string }]
      >;
      expect(calls.some(([a]) => a.activityType === 'field_update')).toBe(false);
    });
  });

  // ── company_linked ────────────────────────────────────────────────────────

  describe('addCompany', () => {
    it('logs company_linked event', async () => {
      (mockRepo.getCompanies as jest.Mock).mockResolvedValue([] as never);
      (mockRepo.addCompany as jest.Mock).mockResolvedValue({
        company: { companyName: 'Acme Corp' },
      } as never);

      await service.addCompany(
        mockDeal.id,
        ORG_ID,
        { companyId: 5 },
        ACTOR_ID,
      );

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'company_linked',
        entityType: 'deal',
        entityId: mockDeal.id,
        actorId: ACTOR_ID,
        metadata: { companyId: 5, companyName: 'Acme Corp' },
      });
    });
  });

  // ── company_unlinked ──────────────────────────────────────────────────────

  describe('removeCompany', () => {
    it('logs company_unlinked event with company name', async () => {
      (mockRepo.getCompanies as jest.Mock).mockResolvedValue([
        { companyId: 5, company: { companyName: 'Acme Corp' } },
      ] as never);
      (mockRepo.removeCompany as jest.Mock).mockResolvedValue({} as never);

      await service.removeCompany(mockDeal.id, ORG_ID, 5, ACTOR_ID);

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'company_unlinked',
        entityType: 'deal',
        entityId: mockDeal.id,
        actorId: ACTOR_ID,
        metadata: { companyId: 5, companyName: 'Acme Corp' },
      });
    });

    it('falls back to "Unknown" when company name is not available', async () => {
      (mockRepo.getCompanies as jest.Mock).mockResolvedValue([] as never);
      (mockRepo.removeCompany as jest.Mock).mockResolvedValue({} as never);

      await service.removeCompany(mockDeal.id, ORG_ID, 99, ACTOR_ID);

      expect(mockActivityService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          activityType: 'company_unlinked',
          metadata: { companyId: 99, companyName: 'Unknown' },
        }),
      );
    });
  });

  // ── contact_linked ────────────────────────────────────────────────────────

  describe('addContact', () => {
    it('logs contact_linked event', async () => {
      (mockRepo.getContacts as jest.Mock).mockResolvedValue([] as never);
      (mockRepo.addContact as jest.Mock).mockResolvedValue({
        contact: { name: 'Jane Smith' },
      } as never);

      await service.addContact(
        mockDeal.id,
        ORG_ID,
        { contactId: 7, role: 'Decision Maker' },
        ACTOR_ID,
      );

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'contact_linked',
        entityType: 'deal',
        entityId: mockDeal.id,
        actorId: ACTOR_ID,
        metadata: { contactId: 7, contactName: 'Jane Smith', role: 'Decision Maker' },
      });
    });

    it('omits role from metadata when not provided', async () => {
      (mockRepo.getContacts as jest.Mock).mockResolvedValue([] as never);
      (mockRepo.addContact as jest.Mock).mockResolvedValue({
        contact: { name: 'Jane Smith' },
      } as never);

      await service.addContact(mockDeal.id, ORG_ID, { contactId: 7 }, ACTOR_ID);

      const calls = (mockActivityService.create as jest.Mock).mock.calls as Array<
        [{ metadata: Record<string, unknown> }]
      >;
      const metadata = calls[0][0].metadata;
      expect(metadata).not.toHaveProperty('role');
    });
  });

  // ── contact_unlinked ──────────────────────────────────────────────────────

  describe('removeContact', () => {
    it('logs contact_unlinked event with contact name', async () => {
      (mockRepo.getContacts as jest.Mock).mockResolvedValue([
        { contactId: 7, contact: { name: 'Jane Smith' } },
      ] as never);
      (mockRepo.removeContact as jest.Mock).mockResolvedValue({} as never);

      await service.removeContact(mockDeal.id, ORG_ID, 7, ACTOR_ID);

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'contact_unlinked',
        entityType: 'deal',
        entityId: mockDeal.id,
        actorId: ACTOR_ID,
        metadata: { contactId: 7, contactName: 'Jane Smith' },
      });
    });

    it('falls back to "Unknown" when contact name is not available', async () => {
      (mockRepo.getContacts as jest.Mock).mockResolvedValue([] as never);
      (mockRepo.removeContact as jest.Mock).mockResolvedValue({} as never);

      await service.removeContact(mockDeal.id, ORG_ID, 99, ACTOR_ID);

      expect(mockActivityService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          activityType: 'contact_unlinked',
          metadata: { contactId: 99, contactName: 'Unknown' },
        }),
      );
    });
  });

  // ── owner_assigned / owner_removed ────────────────────────────────────────

  describe('addOwner', () => {
    it('logs owner_assigned event', async () => {
      (mockRepo.addOwner as jest.Mock).mockResolvedValue({
        user: { name: 'Bob', id: 3 },
      } as never);

      await service.addOwner(mockDeal.id, ORG_ID, 3, false, ACTOR_ID);

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'owner_assigned',
        entityType: 'deal',
        entityId: mockDeal.id,
        actorId: ACTOR_ID,
        metadata: { userId: 3, userName: 'Bob' },
      });
    });
  });

  describe('removeOwner', () => {
    it('logs owner_removed event', async () => {
      (mockRepo.removeOwner as jest.Mock).mockResolvedValue({
        user: { name: 'Bob', id: 3 },
      } as never);

      await service.removeOwner(mockDeal.id, ORG_ID, 3, ACTOR_ID);

      expect(mockActivityService.create).toHaveBeenCalledWith({
        activityType: 'owner_removed',
        entityType: 'deal',
        entityId: mockDeal.id,
        actorId: ACTOR_ID,
        metadata: { userId: 3, userName: 'Bob' },
      });
    });
  });
});
