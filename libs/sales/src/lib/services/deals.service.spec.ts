import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DealsService } from './deals.service';
import { DealsRepository } from '../repositories/deals.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DEAL_EVENTS } from '../events/deal-events';
import { BadRequestException } from '@nestjs/common';
import { TableColumnRepository } from '../repositories/table-column.repository';
import { validateCellValue, castFieldValue } from '../utils/custom-fields';

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

  const mockEventEmitter = {
    emitAsync: jest.fn().mockImplementation(() => Promise.resolve([])),
  };
  
  const mockTableColumnRepository = {
    findByTable: jest.fn(),
  }

  beforeEach(() => {
    service = new DealsService(
      mockRepo as unknown as DealsRepository,
      mockEventEmitter as unknown as EventEmitter2,
      mockTableColumnRepository as unknown as TableColumnRepository,
    );
    jest.clearAllMocks();
    // Default: findById returns the mock deal
    (mockRepo.findById as jest.Mock).mockResolvedValue(mockDeal as never);
  });

  // ── deal.created ──────────────────────────────────────────────────────────

  describe('create', () => {
    it('emits deal.created event after deal is created', async () => {
      (mockRepo.create as jest.Mock).mockResolvedValue(mockDeal as never);

      await service.create(
        { title: 'Test Deal', ownerIds: [1], organizationId: ORG_ID },
        ACTOR_ID,
      );

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.CREATED,
        { dealId: mockDeal.id, actorId: ACTOR_ID },
      );
    });

    it('does not emit event when repo.create throws', async () => {
      (mockRepo.create as jest.Mock).mockRejectedValue(new Error('DB error') as never);

      await expect(
        service.create({ title: 'Test Deal', ownerIds: [1], organizationId: ORG_ID }),
      ).rejects.toThrow('DB error');

      expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when stage is invalid', async () => {
      await expect(
        service.create({ 
          title: 'Test Deal', 
          stage: 'invalid_stage', 
          organizationId: ORG_ID 
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
    });
  });

  // ── deal.stage_changed ────────────────────────────────────────────────────

  describe('update - stage_change', () => {
    it('emits deal.stage_changed when stage differs from existing', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        stage: 'qualification',
      } as never);

      await service.update(mockDeal.id, ORG_ID, { stage: 'qualification' }, ACTOR_ID);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.STAGE_CHANGED,
        expect.objectContaining({
          dealId: mockDeal.id,
          actorId: ACTOR_ID,
          from: 'prospecting',
          to: 'qualification',
        }),
      );
    });

    it('does not emit stage_changed when stage is unchanged', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue(mockDeal as never);

      await service.update(mockDeal.id, ORG_ID, { stage: 'prospecting' }, ACTOR_ID);

      const calls = (mockEventEmitter.emitAsync as jest.Mock).mock.calls as Array<[string, unknown]>;
      expect(calls.some(([event]) => event === DEAL_EVENTS.STAGE_CHANGED)).toBe(false);
    });

    it('throws BadRequestException when updating to an invalid stage', async () => {
      await expect(
        service.update(mockDeal.id, ORG_ID, { stage: 'invalid_stage' }, ACTOR_ID),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
    });
  });

  // ── deal.closed ───────────────────────────────────────────────────────────

  describe('update - deal_closed', () => {
    it('emits deal.closed with outcome=won when actualCloseDate set and stage is closed_won', async () => {
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

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.CLOSED,
        expect.objectContaining({ outcome: 'won' }),
      );
    });

    it('emits deal.closed with outcome=lost when stage is closed_lost', async () => {
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

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.CLOSED,
        expect.objectContaining({ outcome: 'lost', lostReason: 'Price' }),
      );
    });

    it('does not emit deal.closed when actualCloseDate was already set', async () => {
      const dealAlreadyClosed = { ...mockDeal, actualCloseDate: new Date() };
      (mockRepo.findById as jest.Mock).mockResolvedValue(dealAlreadyClosed as never);
      (mockRepo.update as jest.Mock).mockResolvedValue(dealAlreadyClosed as never);

      await service.update(mockDeal.id, ORG_ID, { actualCloseDate: new Date() }, ACTOR_ID);

      const calls = (mockEventEmitter.emitAsync as jest.Mock).mock.calls as Array<[string, unknown]>;
      expect(calls.some(([event]) => event === DEAL_EVENTS.CLOSED)).toBe(false);
    });
  });

  // ── deal.field_updated ────────────────────────────────────────────────────

  describe('update - field_update', () => {
    it('emits deal.field_updated for each changed field', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue({
        ...mockDeal,
        value: 9999,
        probability: 80,
      } as never);

      await service.update(mockDeal.id, ORG_ID, { value: 9999, probability: 80 }, ACTOR_ID);

      const calls = (mockEventEmitter.emitAsync as jest.Mock).mock.calls as Array<[string, { field: string }]>;
      const fieldUpdates = calls
        .filter(([event]) => event === DEAL_EVENTS.FIELD_UPDATED)
        .map(([, payload]) => payload.field);

      expect(fieldUpdates).toContain('value');
      expect(fieldUpdates).toContain('probability');
    });

    it('does not emit field_updated when value is unchanged', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue(mockDeal as never);

      await service.update(mockDeal.id, ORG_ID, { value: 5000 }, ACTOR_ID);

      const calls = (mockEventEmitter.emitAsync as jest.Mock).mock.calls as Array<[string, unknown]>;
      expect(calls.some(([event]) => event === DEAL_EVENTS.FIELD_UPDATED)).toBe(false);
    });

    it('emits field_updated for fields not previously in the hardcoded list (e.g. currency)', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue({ ...mockDeal, currency: 'EUR' } as never);

      await service.update(mockDeal.id, ORG_ID, { currency: 'EUR' }, ACTOR_ID);

      const calls = (mockEventEmitter.emitAsync as jest.Mock).mock.calls as Array<[string, { field: string }]>;
      const fields = calls
        .filter(([event]) => event === DEAL_EVENTS.FIELD_UPDATED)
        .map(([, payload]) => payload.field);
      expect(fields).toContain('currency');
    });

    it('does not emit field_updated for excluded fields (stage, actualCloseDate, lostReason, isHidden)', async () => {
      (mockRepo.update as jest.Mock).mockResolvedValue({ ...mockDeal, stage: 'qualification' } as never);

      await service.update(
        mockDeal.id,
        ORG_ID,
        { stage: 'qualification', actualCloseDate: new Date(), lostReason: 'Price', isHidden: true },
        ACTOR_ID,
      );

      const calls = (mockEventEmitter.emitAsync as jest.Mock).mock.calls as Array<[string, { field: string }]>;
      const fieldUpdateFields = calls
        .filter(([event]) => event === DEAL_EVENTS.FIELD_UPDATED)
        .map(([, payload]) => payload.field);

      expect(fieldUpdateFields).not.toContain('stage');
      expect(fieldUpdateFields).not.toContain('actualCloseDate');
      expect(fieldUpdateFields).not.toContain('lostReason');
      expect(fieldUpdateFields).not.toContain('isHidden');
    });
  });

  // ── deal.company_linked ───────────────────────────────────────────────────

  describe('addCompany', () => {
    it('emits deal.company_linked event', async () => {
      (mockRepo.getCompanies as jest.Mock).mockResolvedValue([] as never);
      (mockRepo.addCompany as jest.Mock).mockResolvedValue({
        company: { companyName: 'Acme Corp' },
      } as never);

      await service.addCompany(mockDeal.id, ORG_ID, { companyId: 5 }, ACTOR_ID);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.COMPANY_LINKED,
        { dealId: mockDeal.id, actorId: ACTOR_ID, companyId: 5, companyName: 'Acme Corp' },
      );
    });
  });

  // ── deal.company_unlinked ─────────────────────────────────────────────────

  describe('removeCompany', () => {
    it('emits deal.company_unlinked event with company name', async () => {
      (mockRepo.getCompanies as jest.Mock).mockResolvedValue([
        { companyId: 5, company: { companyName: 'Acme Corp' } },
      ] as never);
      (mockRepo.removeCompany as jest.Mock).mockResolvedValue({} as never);

      await service.removeCompany(mockDeal.id, ORG_ID, 5, ACTOR_ID);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.COMPANY_UNLINKED,
        { dealId: mockDeal.id, actorId: ACTOR_ID, companyId: 5, companyName: 'Acme Corp' },
      );
    });

    it('falls back to "Unknown" when company name is not available', async () => {
      (mockRepo.getCompanies as jest.Mock).mockResolvedValue([] as never);
      (mockRepo.removeCompany as jest.Mock).mockResolvedValue({} as never);

      await service.removeCompany(mockDeal.id, ORG_ID, 99, ACTOR_ID);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.COMPANY_UNLINKED,
        expect.objectContaining({ companyId: 99, companyName: 'Unknown' }),
      );
    });
  });

  // ── deal.contact_linked ───────────────────────────────────────────────────

  describe('addContact', () => {
    it('emits deal.contact_linked event', async () => {
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

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.CONTACT_LINKED,
        { dealId: mockDeal.id, actorId: ACTOR_ID, contactId: 7, contactName: 'Jane Smith', role: 'Decision Maker' },
      );
    });

    it('omits role from payload when not provided', async () => {
      (mockRepo.getContacts as jest.Mock).mockResolvedValue([] as never);
      (mockRepo.addContact as jest.Mock).mockResolvedValue({
        contact: { name: 'Jane Smith' },
      } as never);

      await service.addContact(mockDeal.id, ORG_ID, { contactId: 7 }, ACTOR_ID);

      const calls = (mockEventEmitter.emitAsync as jest.Mock).mock.calls as Array<[string, Record<string, unknown>]>;
      const payload = calls.find(([event]) => event === DEAL_EVENTS.CONTACT_LINKED)?.[1];
      expect(payload).not.toHaveProperty('role');
    });
  });

  // ── deal.contact_unlinked ─────────────────────────────────────────────────

  describe('removeContact', () => {
    it('emits deal.contact_unlinked event with contact name', async () => {
      (mockRepo.getContacts as jest.Mock).mockResolvedValue([
        { contactId: 7, contact: { name: 'Jane Smith' } },
      ] as never);
      (mockRepo.removeContact as jest.Mock).mockResolvedValue({} as never);

      await service.removeContact(mockDeal.id, ORG_ID, 7, ACTOR_ID);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.CONTACT_UNLINKED,
        { dealId: mockDeal.id, actorId: ACTOR_ID, contactId: 7, contactName: 'Jane Smith' },
      );
    });

    it('falls back to "Unknown" when contact name is not available', async () => {
      (mockRepo.getContacts as jest.Mock).mockResolvedValue([] as never);
      (mockRepo.removeContact as jest.Mock).mockResolvedValue({} as never);

      await service.removeContact(mockDeal.id, ORG_ID, 99, ACTOR_ID);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.CONTACT_UNLINKED,
        expect.objectContaining({ contactId: 99, contactName: 'Unknown' }),
      );
    });
  });

  // ── deal.owner_assigned / deal.owner_removed ──────────────────────────────

  describe('addOwner', () => {
    it('emits deal.owner_assigned event', async () => {
      (mockRepo.addOwner as jest.Mock).mockResolvedValue({
        user: { name: 'Bob', id: 3 },
      } as never);

      await service.addOwner(mockDeal.id, ORG_ID, 3, false, ACTOR_ID);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.OWNER_ASSIGNED,
        { dealId: mockDeal.id, actorId: ACTOR_ID, userId: 3, userName: 'Bob' },
      );
    });
  });

  describe('removeOwner', () => {
    it('emits deal.owner_removed event', async () => {
      (mockRepo.removeOwner as jest.Mock).mockResolvedValue({
        user: { name: 'Bob', id: 3 },
      } as never);

      await service.removeOwner(mockDeal.id, ORG_ID, 3, ACTOR_ID);

      expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
        DEAL_EVENTS.OWNER_REMOVED,
        { dealId: mockDeal.id, actorId: ACTOR_ID, userId: 3, userName: 'Bob' },
      );
    });
  });
});
