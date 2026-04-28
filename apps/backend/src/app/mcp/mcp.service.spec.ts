import { NotFoundException } from '@nestjs/common';
import { McpService } from './mcp.service';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DealsRepository,
  ContactsRepository,
  CompaniesRepository,
  CompaniesService,
  DealsService,
  TaskRepository,
} from '@zuko/sales';
import { PrismaService } from '../../prisma/prisma.service';

const ORG_ID = 1;
const USER_ID = 10;

const mockPrisma = {
  member: {
    findFirst: vi.fn(),
  },
};

const mockDealsRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  hide: vi.fn(),
};

const mockContactsRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  hide: vi.fn(),
};

const mockCompaniesRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  hide: vi.fn(),
};

const mockTaskRepository = {
  findAll: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockCompaniesService = {
  addContact: vi.fn(),
  removeContact: vi.fn(),
};

const mockDealsService = {
  addCompany: vi.fn(),
  addContact: vi.fn(),
  removeCompany: vi.fn(),
  removeContact: vi.fn(),
};

describe('McpService', () => {
  let service: McpService;

  beforeEach(() => {
    service = new McpService(
      mockDealsRepository as unknown as DealsRepository,
      mockContactsRepository as unknown as ContactsRepository,
      mockCompaniesRepository as unknown as CompaniesRepository,
      mockCompaniesService as unknown as CompaniesService,
      mockDealsService as unknown as DealsService,
      mockTaskRepository as unknown as TaskRepository,
      mockPrisma as unknown as PrismaService,
    );
    vi.clearAllMocks();
  });

  // ── resolveOrganizationId ────────────────────────────────────────────────

  describe('resolveOrganizationId', () => {
    it('returns organizationId when member exists', async () => {
      mockPrisma.member.findFirst.mockResolvedValue({ organizationId: ORG_ID });

      const result = await service.resolveOrganizationId(USER_ID);

      expect(mockPrisma.member.findFirst).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        select: { organizationId: true },
      });
      expect(result).toBe(ORG_ID);
    });

    it('throws NotFoundException when member does not exist', async () => {
      mockPrisma.member.findFirst.mockResolvedValue(null);

      await expect(service.resolveOrganizationId(USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── handleRequest ────────────────────────────────────────────────────────

  describe('handleRequest', () => {
    it('returns a Response object', async () => {
      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);

      expect(response).toBeInstanceOf(Response);
    });
  });

  // ── buildServer tools ────────────────────────────────────────────────────

  describe('list_deals tool', () => {
    it('calls dealsRepository.findAll with org scope', async () => {
      mockDealsRepository.findAll.mockResolvedValue({
        deals: [],
        pagination: { total: 0 },
      });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'list_deals', arguments: { limit: 10 } },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text(); // drain the stream so the tool callback completes

      expect(mockDealsRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, isHidden: false }),
        expect.objectContaining({ page: 1, limit: 10 }),
      );
    });
  });

  describe('list_contacts tool', () => {
    it('calls contactsRepository.findAll with org scope', async () => {
      mockContactsRepository.findAll.mockResolvedValue({
        contacts: [],
        pagination: { total: 0 },
      });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'list_contacts', arguments: { limit: 20 } },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockContactsRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, isHidden: false }),
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });
  });

  describe('list_companies tool', () => {
    it('calls companiesRepository.findAll with org scope', async () => {
      mockCompaniesRepository.findAll.mockResolvedValue({
        companies: [],
        pagination: { total: 0 },
      });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'list_companies', arguments: {} },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockCompaniesRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: ORG_ID, isHidden: false }),
        expect.objectContaining({ page: 1 }),
      );
    });
  });

  describe('list_tasks tool', () => {
    it('calls taskRepository.findAll with org scope', async () => {
      mockTaskRepository.findAll.mockResolvedValue({
        tasks: [],
        pagination: { total: 0 },
      });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'list_tasks', arguments: {} },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockTaskRepository.findAll).toHaveBeenCalledWith(
        ORG_ID,
        expect.objectContaining({ page: 1 }),
      );
    });
  });

  describe('associate_contact_with_company tool', () => {
    it('calls companiesService.addContact with relation payload', async () => {
      mockCompaniesService.addContact.mockResolvedValue({
        id: 1,
        companyId: 7,
        contactId: 11,
      });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'associate_contact_with_company',
            arguments: { companyId: 7, contactId: 11, isPrimary: true },
          },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockCompaniesService.addContact).toHaveBeenCalledWith(
        7,
        ORG_ID,
        expect.objectContaining({ contactId: 11, isPrimary: true }),
        USER_ID,
      );
    });
  });

  describe('associate_contacts_with_company tool', () => {
    it('deduplicates contactIds before associating them', async () => {
      mockCompaniesService.addContact.mockResolvedValue({
        id: 1,
        companyId: 7,
        contactId: 11,
      });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'associate_contacts_with_company',
            arguments: { companyId: 7, contactIds: [11, 11, 12] },
          },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockCompaniesService.addContact).toHaveBeenCalledTimes(2);
      expect(mockCompaniesService.addContact).toHaveBeenNthCalledWith(
        1,
        7,
        ORG_ID,
        expect.objectContaining({ contactId: 11 }),
        USER_ID,
      );
      expect(mockCompaniesService.addContact).toHaveBeenNthCalledWith(
        2,
        7,
        ORG_ID,
        expect.objectContaining({ contactId: 12 }),
        USER_ID,
      );
    });
  });

  describe('associate_companies_with_deal tool', () => {
    it('calls dealsService.addCompany for each unique company', async () => {
      mockDealsService.addCompany.mockResolvedValue({
        id: 1,
        dealId: 5,
        companyId: 9,
      });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'associate_companies_with_deal',
            arguments: { dealId: 5, companyIds: [9, 9, 10], primaryCompanyId: 10 },
          },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockDealsService.addCompany).toHaveBeenCalledTimes(2);
      expect(mockDealsService.addCompany).toHaveBeenNthCalledWith(
        1,
        5,
        ORG_ID,
        expect.objectContaining({ companyId: 9, isPrimary: false }),
        USER_ID,
      );
      expect(mockDealsService.addCompany).toHaveBeenNthCalledWith(
        2,
        5,
        ORG_ID,
        expect.objectContaining({ companyId: 10, isPrimary: true }),
        USER_ID,
      );
    });
  });

  describe('associate_companyies_with_deal tool', () => {
    it('supports the compatibility alias', async () => {
      mockDealsService.addCompany.mockResolvedValue({
        id: 1,
        dealId: 5,
        companyId: 9,
      });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'associate_companyies_with_deal',
            arguments: { dealId: 5, companyIds: [9] },
          },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockDealsService.addCompany).toHaveBeenCalledWith(
        5,
        ORG_ID,
        expect.objectContaining({ companyId: 9 }),
        USER_ID,
      );
    });
  });

  describe('associate_contacts_with_deal tool', () => {
    it('calls dealsService.addContact for each unique contact', async () => {
      mockDealsService.addContact.mockResolvedValue({
        id: 1,
        dealId: 5,
        contactId: 21,
      });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'associate_contacts_with_deal',
            arguments: { dealId: 5, contactIds: [21, 21, 22], primaryContactId: 22, role: 'buyer' },
          },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockDealsService.addContact).toHaveBeenCalledTimes(2);
      expect(mockDealsService.addContact).toHaveBeenNthCalledWith(
        1,
        5,
        ORG_ID,
        expect.objectContaining({
          contactId: 21,
          role: 'buyer',
          isPrimary: false,
        }),
        USER_ID,
      );
      expect(mockDealsService.addContact).toHaveBeenNthCalledWith(
        2,
        5,
        ORG_ID,
        expect.objectContaining({
          contactId: 22,
          role: 'buyer',
          isPrimary: true,
        }),
        USER_ID,
      );
    });
  });

  describe('unassociate_contact_from_company tool', () => {
    it('calls companiesService.removeContact with the relation identifiers', async () => {
      mockCompaniesService.removeContact.mockResolvedValue({ count: 1 });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'unassociate_contact_from_company',
            arguments: { companyId: 7, contactId: 11 },
          },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockCompaniesService.removeContact).toHaveBeenCalledWith(
        7,
        ORG_ID,
        11,
        USER_ID,
      );
    });
  });

  describe('unassociate_contacts_from_company tool', () => {
    it('deduplicates contactIds before removing them', async () => {
      mockCompaniesService.removeContact.mockResolvedValue({ count: 1 });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'unassociate_contacts_from_company',
            arguments: { companyId: 7, contactIds: [11, 11, 12] },
          },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockCompaniesService.removeContact).toHaveBeenCalledTimes(2);
      expect(mockCompaniesService.removeContact).toHaveBeenNthCalledWith(
        1,
        7,
        ORG_ID,
        11,
        USER_ID,
      );
      expect(mockCompaniesService.removeContact).toHaveBeenNthCalledWith(
        2,
        7,
        ORG_ID,
        12,
        USER_ID,
      );
    });
  });

  describe('unassociate_companies_from_deal tool', () => {
    it('calls dealsService.removeCompany for each unique company', async () => {
      mockDealsService.removeCompany.mockResolvedValue({ count: 1 });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'unassociate_companies_from_deal',
            arguments: { dealId: 5, companyIds: [9, 9, 10] },
          },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockDealsService.removeCompany).toHaveBeenCalledTimes(2);
      expect(mockDealsService.removeCompany).toHaveBeenNthCalledWith(
        1,
        5,
        ORG_ID,
        9,
        USER_ID,
      );
      expect(mockDealsService.removeCompany).toHaveBeenNthCalledWith(
        2,
        5,
        ORG_ID,
        10,
        USER_ID,
      );
    });
  });

  describe('unassociate_companyies_from_deal tool', () => {
    it('supports the compatibility alias for removal', async () => {
      mockDealsService.removeCompany.mockResolvedValue({ count: 1 });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'unassociate_companyies_from_deal',
            arguments: { dealId: 5, companyIds: [9] },
          },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockDealsService.removeCompany).toHaveBeenCalledWith(
        5,
        ORG_ID,
        9,
        USER_ID,
      );
    });
  });

  describe('unassociate_contacts_from_deal tool', () => {
    it('calls dealsService.removeContact for each unique contact', async () => {
      mockDealsService.removeContact.mockResolvedValue({ count: 1 });

      const req = new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'unassociate_contacts_from_deal',
            arguments: { dealId: 5, contactIds: [21, 21, 22] },
          },
        }),
      });

      const response = await service.handleRequest(req, ORG_ID, USER_ID);
      await response.text();

      expect(mockDealsService.removeContact).toHaveBeenCalledTimes(2);
      expect(mockDealsService.removeContact).toHaveBeenNthCalledWith(
        1,
        5,
        ORG_ID,
        21,
        USER_ID,
      );
      expect(mockDealsService.removeContact).toHaveBeenNthCalledWith(
        2,
        5,
        ORG_ID,
        22,
        USER_ID,
      );
    });
  });
});
