import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TableService } from './table.service';
import {
  CompaniesService,
  ContactsService,
  DealsService,
  COMPANY_TABLE_METADATA,
  CONTACT_TABLE_METADATA,
  DEAL_TABLE_METADATA,
} from '@zuko/sales';
import { TableRowBuilder } from './row-builder/table-row.builder';

describe('TableService', () => {
  let service: TableService;
  let companiesService: jest.Mocked<CompaniesService>;
  let contactsService: jest.Mocked<ContactsService>;
  let dealsService: jest.Mocked<DealsService>;
  let rowBuilder: jest.Mocked<TableRowBuilder>;

  beforeEach(async () => {
    const mockCompaniesService = {
      findAll: jest.fn(),
    };
    const mockContactsService = {
      findAll: jest.fn(),
    };
    const mockDealsService = {
      findAll: jest.fn(),
    };
    const mockRowBuilder = {
      buildRows: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableService,
        { provide: CompaniesService, useValue: mockCompaniesService },
        { provide: ContactsService, useValue: mockContactsService },
        { provide: DealsService, useValue: mockDealsService },
        { provide: TableRowBuilder, useValue: mockRowBuilder },
      ],
    }).compile();

    service = module.get<TableService>(TableService);
    companiesService = module.get(CompaniesService);
    contactsService = module.get(ContactsService);
    dealsService = module.get(DealsService);
    rowBuilder = module.get(TableRowBuilder);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCompaniesTable', () => {
    it('fetches companies and returns formatted table data', async () => {
      const mockResult = {
        companies: [{ id: 1, name: 'Test Cor' }],
        pagination: { total: 1, page: 1, limit: 50, totalPages: 1 },
      };
      companiesService.findAll.mockResolvedValue(mockResult as any);
      rowBuilder.buildRows.mockReturnValue(mockResult.companies as any);

      const result = await service.getCompaniesTable(1, {
        page: '1',
        limit: '50',
      } as any);

      expect(companiesService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 1 }),
        { page: 1, limit: 50 },
      );
      expect(rowBuilder.buildRows).toHaveBeenCalledWith(
        mockResult.companies,
        COMPANY_TABLE_METADATA,
      );
      expect(result).toEqual({
        metadata: COMPANY_TABLE_METADATA,
        data: mockResult.companies,
        pagination: mockResult.pagination,
      });
    });
  });

  describe('getContactsTable', () => {
    it('should fetch contacts and return formatted table data', async () => {
      const mockResult = {
        contacts: [{ id: 1, firstName: 'John' }],
        pagination: { total: 1, page: 1, limit: 50, totalPages: 1 },
      };
      contactsService.findAll.mockResolvedValue(mockResult as any);
      rowBuilder.buildRows.mockReturnValue(mockResult.contacts as any);

      const result = await service.getContactsTable(1, {
        page: '1',
        limit: '50',
      } as any);

      expect(contactsService.findAll).toHaveBeenCalled();
      expect(rowBuilder.buildRows).toHaveBeenCalledWith(
        mockResult.contacts,
        CONTACT_TABLE_METADATA,
      );
      expect(result.metadata).toEqual(CONTACT_TABLE_METADATA);
    });
  });

  describe('getDealsTable', () => {
    it('should fetch deals and return formatted table data', async () => {
      const mockResult = {
        deals: [{ id: 1, title: 'Big Deal' }],
        pagination: { total: 1, page: 1, limit: 50, totalPages: 1 },
      };
      dealsService.findAll.mockResolvedValue(mockResult as any);
      rowBuilder.buildRows.mockReturnValue(mockResult.deals as any);

      const result = await service.getDealsTable(1, {
        page: '1',
        limit: '50',
      } as any);

      expect(dealsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 1 }),
        { page: 1, limit: 50 },
      );
      expect(rowBuilder.buildRows).toHaveBeenCalledWith(
        mockResult.deals,
        DEAL_TABLE_METADATA,
      );
      expect(result.metadata).toEqual(DEAL_TABLE_METADATA);
    });

    it('correctly parses complex filters for deals', async () => {
      const query = {
        ownerIds: '1,2',
        companyIds: '3,4',
        stages: 'lead,qualified',
        minValue: 1000,
        expectedCloseFrom: '2025-01-01',
        page: 1,
        limit: 50,
      };
      dealsService.findAll.mockResolvedValue({
        deals: [],
        pagination: {},
      } as any);

      await service.getDealsTable(1, query);

      expect(dealsService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerIds: [1, 2],
          companyIds: [3, 4],
          stages: ['lead', 'qualified'],
          minValue: 1000,
          expectedCloseFrom: new Date('2025-01-01'),
        }),
        { page: 1, limit: 50 },
      );
    });
  });
});
