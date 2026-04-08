import { describe, it, expect, beforeEach, beforeAll, afterAll, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { TableService } from './table.service';
import {
  CompaniesService,
  ContactsService,
  DealsService,
  TableColumnRepository,
  ColumnType,
  CompaniesRepository,
  ContactsRepository,
  DealsRepository,
  ColumnMetadata,
} from '@zuko/sales';
import { TableRowBuilder } from './row-builder/table-row.builder';
import { PrismaService } from '../../../prisma/prisma.service';
import { Contact, Company, Organization, TableColumn, User, Deal } from '@prisma/client';
import { CreateColumnDto, UpdateCellDto } from './table.controller';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CompanyListQueryDto } from '../companies.controller';
import { ContactListQueryDto } from '../contacts.controller';
import { DealListQueryDto } from '../deals.controller';

describe('TableService', () => {
  let service: TableService;
  let prisma: PrismaService;

  let testOrg: Organization;
  let testUser: User;

  beforeAll(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    prisma = module.get(PrismaService);

    const uniqueId = Date.now();
    testOrg = await prisma.organization.create({
      data: {
        name: `Test Org ${uniqueId}`,
        slug: `test-org-${uniqueId}`,
        createdAt: new Date(),
      },
    });
    testUser = await prisma.user.create({
      data: {
        name: `Test User ${uniqueId}`,
        email: `test-${uniqueId}@example.com`,
        createdAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    if (testOrg?.id) await prisma.organization.delete({ where: { id: testOrg.id } }).catch(() => undefined);
    if (testUser?.id) await prisma.user.delete({ where: { id: testUser.id } }).catch(() => undefined);

    if (prisma) {
      await prisma.$disconnect();
    }
    jest.clearAllMocks();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        TableService,
        TableRowBuilder,
        EventEmitter2,
        {
          provide: CompaniesRepository,
          useFactory: (p: PrismaService) => new CompaniesRepository(p),
          inject: [PrismaService],
        },
        {
          provide: CompaniesService,
          useFactory: (r: CompaniesRepository, e: EventEmitter2, t: TableColumnRepository) => new CompaniesService(r, e, t),
          inject: [CompaniesRepository, EventEmitter2, TableColumnRepository],
        },
        {
          provide: ContactsRepository,
          useFactory: (p: PrismaService) => new ContactsRepository(p),
          inject: [PrismaService],
        },
        {
          provide: ContactsService,
          useFactory: (r: ContactsRepository, e: EventEmitter2, t: TableColumnRepository) => new ContactsService(r, e, t),
          inject: [ContactsRepository, EventEmitter2, TableColumnRepository],
        },
        {
          provide: DealsRepository,
          useFactory: (p: PrismaService) => new DealsRepository(p),
          inject: [PrismaService],
        },
        {
          provide: DealsService,
          useFactory: (r: DealsRepository, e: EventEmitter2, t: TableColumnRepository) => new DealsService(r, e, t),
          inject: [DealsRepository, EventEmitter2, TableColumnRepository],
        },
        {
          provide: TableColumnRepository,
          useFactory: (prisma: PrismaService) => new TableColumnRepository(prisma),
          inject: [PrismaService],
        },
      ],
    }).compile();

    service = module.get<TableService>(TableService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCompaniesTable', () => {
    let testOrg2: Organization;
    let customCol: TableColumn;
    let company1: Company;
    let company2: Company;

    beforeAll(async () => {
      const uniqueId = Date.now() + 1000;
      testOrg2 = await prisma.organization.create({
        data: {
          name: `Test Org 2 ${uniqueId}`,
          slug: `test-org-2-${uniqueId}`,
          createdAt: new Date(),
        },
      });

      // 1. Create a custom column for the main test org
      customCol = await service.createColumn(
        'companies',
        testOrg.id,
        testUser.id,
        {
          label: 'Industry Type',
          columnKey: 'industry_type',
          fieldType: 'text' as ColumnType,
        },
      );

      // 2. Create companies across 2 orgs to verify isolation and correct column handling
      company1 = await prisma.company.create({
        data: {
          organizationId: testOrg.id,
          companyName: 'Apple Inc',
          website: 'https://apple.com',
          fields: { industry_type: 'Technology' },
          owners: {
            create: { userId: testUser.id, isPrimary: true },
          },
        },
      });

      company2 = await prisma.company.create({
        data: {
          organizationId: testOrg.id,
          companyName: 'The Republic',
          website: 'https://therepublic.com',
          fields: { industry_type: 'Retail' },
        },
      });

      // Company in another org (should not appear in Org 1 results)
      await prisma.company.create({
        data: {
          organizationId: testOrg2.id,
          companyName: 'Orange Corp',
          website: 'https://orange.com',
        },
      });
    });

    afterAll(async () => {
      // Cleanup companies and custom columns
      await prisma.companyOwner.deleteMany({
        where: { companyId: { in: [company1.id, company2.id] } },
      });
      await prisma.company.deleteMany({
        where: { id: { in: [company1.id, company2.id] } },
      });
      if (customCol?.id) {
        await prisma.tableColumn.delete({ where: { id: customCol.id } });
      }

      if (testOrg2?.id) {
        await prisma.companyOwner.deleteMany({
          where: { company: { organizationId: testOrg2.id } },
        });
        await prisma.company.deleteMany({ where: { organizationId: testOrg2.id } });
        await prisma.organization
          .delete({ where: { id: testOrg2.id } })
          .catch(() => undefined);
      }
    });

    it('merges custom column metadata with default columns', async () => {
      const result = await service.getCompaniesTable(testOrg.id, {
        page: 1,
        limit: 50,
      } as CompanyListQueryDto);

      expect(result.metadata.some((m: ColumnMetadata) => m.id === 'industry_type')).toBe(true);
      expect(result.metadata.find((m: ColumnMetadata) => m.id === 'companyName')).toBeDefined();
    });

    it('returns company data with flattened custom fields', async () => {
      const result = await service.getCompaniesTable(testOrg.id, {
        page: 1,
        limit: 50,
      } as CompanyListQueryDto);

      expect(result.data.length).toBe(2);
      const apple = result.data.find((d) => d.companyName === 'Apple Inc');
      expect(apple?.industry_type).toBe('Technology'); // Flattened from 'fields'
      expect(apple?.website).toBe('https://apple.com');
    });

    it('filters results by ownerIds', async () => {
      const result = await service.getCompaniesTable(testOrg.id, {
        ownerIds: testUser.id.toString(),
      } as CompanyListQueryDto);

      expect(result.data.length).toBe(1);
      expect(result.data[0].companyName).toBe('Apple Inc');
    });

    it('searches companies by name', async () => {
      const result = await service.getCompaniesTable(testOrg.id, {
        search: 'Republic',
      } as CompanyListQueryDto);

      expect(result.data.length).toBe(1);
      expect(result.data[0].companyName).toBe('The Republic');
    });

    it('searches companies by custom field value', async () => {
      const result = await service.getCompaniesTable(testOrg.id, {
        search: 'Technology',
      } as CompanyListQueryDto);

      expect(result.data.length).toBe(1);
      expect(result.data[0].companyName).toContain('Apple Inc');
    });

    it('handles pagination correctly', async () => {
      const result = await service.getCompaniesTable(testOrg.id, {
        page: 1,
        limit: 1,
      } as CompanyListQueryDto);

      expect(result.data.length).toBe(1);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(2);
    });
  });

  describe('getContactsTable', () => {
    let testOrg2: Organization;
    let customCol: TableColumn;
    let contact1: Contact;
    let contact2: Contact;

    beforeAll(async () => {
      const uniqueId = Date.now() + 2000;
      testOrg2 = await prisma.organization.create({
        data: {
          name: `Contacts Org ${uniqueId}`,
          slug: `contacts-org-${uniqueId}`,
          createdAt: new Date(),
        },
      });

      customCol = await service.createColumn(
        'contacts',
        testOrg.id,
        testUser.id,
        {
          label: 'Source',
          columnKey: 'source',
          fieldType: 'text' as ColumnType,
        },
      );

      contact1 = await prisma.contact.create({
        data: {
          organizationId: testOrg.id,
          name: `John Doe ${uniqueId}`,
          email: `john-${uniqueId}@example.com`,
          fields: { source: 'linkedin' },
          createdAt: new Date(),
        },
      });

      contact2 = await prisma.contact.create({
        data: {
          organizationId: testOrg.id,
          name: `Jane Smith ${uniqueId}`,
          email: `jane-${uniqueId}@example.com`,
          fields: { source: 'reddit' },
          createdAt: new Date(),
        },
      });

      // Contact in another org
      await prisma.contact.create({
        data: {
          organizationId: testOrg2.id,
          name: `Alien Contact ${uniqueId}`,
          email: `alien-${uniqueId}@example.com`,
        },
      });
    });

    afterAll(async () => {
      await prisma.contact.deleteMany({
        where: { id: { in: [contact1.id, contact2.id] } },
      });
      if (customCol?.id) {
        await prisma.tableColumn.delete({ where: { id: customCol.id } });
      }

      if (testOrg2?.id) {
        await prisma.contact.deleteMany({ where: { organizationId: testOrg2.id } });
        await prisma.organization.delete({ where: { id: testOrg2.id } }).catch(() => undefined);
      }
    });

    it('merges custom column metadata with default columns', async () => {
      const result = await service.getContactsTable(testOrg.id, {
        page: 1,
        limit: 50,
      } as ContactListQueryDto);

      expect(result.metadata.some((m: ColumnMetadata) => m.id === 'source')).toBe(true);
      expect(result.metadata.find((m: ColumnMetadata) => m.id === 'name')).toBeDefined();
    });

    it('returns contact data with flattened custom fields', async () => {
      const result = await service.getContactsTable(testOrg.id, {
        page: 1,
        limit: 50,
      } as ContactListQueryDto);

      expect(result.data.length).toBe(2);
      const john = result.data.find((d) => d.name.startsWith('John Doe'));
      expect(john?.source).toBe('linkedin');
    });

    it('searches contacts by name or email', async () => {
      const result = await service.getContactsTable(testOrg.id, {
        search: 'Jane',
      } as ContactListQueryDto);

      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toContain('Jane Smith');
    });

    it('searches contacts by custom field value', async () => {
      const result = await service.getContactsTable(testOrg.id, {
        search: 'linkedin',
      } as ContactListQueryDto);

      expect(result.data.length).toBe(1);
      expect(result.data[0].name).toContain('John Doe');
    });

    it('handles pagination correctly', async () => {
      const result = await service.getContactsTable(testOrg.id, {
        page: 1,
        limit: 1,
      } as ContactListQueryDto);

      expect(result.data.length).toBe(1);
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('getDealsTable', () => {
    let testOrg2: Organization;
    let customCol: TableColumn;
    let deal1: Deal;
    let deal2: Deal;

    beforeAll(async () => {
      const uniqueId = Date.now() + 3000;
      testOrg2 = await prisma.organization.create({
        data: {
          name: `Deals Org ${uniqueId}`,
          slug: `deals-org-${uniqueId}`,
          createdAt: new Date(),
        },
      });

      customCol = await service.createColumn(
        'deals',
        testOrg.id,
        testUser.id,
        {
          label: 'Priority Score',
          columnKey: 'priority_score',
          fieldType: 'number' as ColumnType,
        },
      );

      deal1 = await prisma.deal.create({
        data: {
          organizationId: testOrg.id,
          title: `Big Deal ${uniqueId}`,
          value: 10000,
          stage: 'prospecting',
          fields: { priority_score: 'SCORE_HIGH' },
          createdAt: new Date(),
        },
      });

      deal2 = await prisma.deal.create({
        data: {
          organizationId: testOrg.id,
          title: `Small Deal ${uniqueId}`,
          value: 2000,
          stage: 'qualification',
          fields: { priority_score: 40 },
          createdAt: new Date(),
        },
      });

      // Deal in another org
      await prisma.deal.create({
        data: {
          organizationId: testOrg2.id,
          title: `Ghost Deal ${uniqueId}`,
          value: 5000,
          stage: 'prospecting',
        },
      });
    });

    afterAll(async () => {
      await prisma.deal.deleteMany({
        where: { id: { in: [deal1.id, deal2.id] } },
      });
      if (customCol?.id) {
        await prisma.tableColumn.delete({ where: { id: customCol.id } });
      }

      if (testOrg2?.id) {
        await prisma.deal.deleteMany({ where: { organizationId: testOrg2.id } });
        await prisma.organization.delete({ where: { id: testOrg2.id } }).catch(() => undefined);
      }
    });

    it('merges custom column metadata with default columns', async () => {
      const result = await service.getDealsTable(testOrg.id, {
        page: 1,
        limit: 50,
      } as DealListQueryDto);

      expect(result.metadata.some((m: ColumnMetadata) => m.id === 'priority_score')).toBe(true);
      expect(result.metadata.find((m: ColumnMetadata) => m.id === 'title')).toBeDefined();
    });

    it('returns deal data with flattened custom fields', async () => {
      const result = await service.getDealsTable(testOrg.id, {
        page: 1,
        limit: 50,
      } as DealListQueryDto);

      expect(result.data.length).toBe(2);
      const bigDeal = result.data.find((d) => d.title.startsWith('Big Deal'));
      expect(bigDeal?.priority_score).toBe("SCORE_HIGH");
    });

    it('filters deals by stage and value', async () => {
      const result = await service.getDealsTable(testOrg.id, {
        stages: 'qualification',
        minValue: '1000',
      } as unknown as DealListQueryDto);

      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toContain('Small Deal');
    });

    it('searches deals by title', async () => {
      const result = await service.getDealsTable(testOrg.id, {
        search: 'Big',
      } as DealListQueryDto);

      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toContain('Big Deal');
    });

    it('searches deals by custom field value', async () => {
      const result = await service.getDealsTable(testOrg.id, {
        search: 'SCORE_HIGH',
      } as unknown as DealListQueryDto);

      expect(result.data.length).toBe(1);
      expect(result.data[0].title).toContain('Big Deal');
    }); 

    it('handles pagination correctly', async () => {
      const result = await service.getDealsTable(testOrg.id, {
        page: 1,
        limit: 1,
      } as DealListQueryDto);

      expect(result.data.length).toBe(1);
      expect(result.pagination.total).toBe(2);
    });
  });

  describe('createColumn', () => {
    const getMockDto = () => ({
      label: 'Custom Field',
      columnKey: `field_${Date.now()}`,
      fieldType: 'text' as ColumnType,
    });

    it('creates column for deals entity', async () => {
      const dto = getMockDto();
      const result = await service.createColumn('deals', testOrg.id, testUser.id, dto);

      expect(result).toBeDefined();
      expect(result.columnKey).toBe(dto.columnKey);

      const dbColumn = await prisma.tableColumn.findUnique({
        where: {
          organizationId_tableName_columnKey: {
            organizationId: testOrg.id,
            tableName: 'deals',
            columnKey: dto.columnKey,
          },
        },
      });

      expect(dbColumn).toBeDefined();
      expect(dbColumn).toMatchObject({
        label: dto.label,
        columnKey: dto.columnKey,
        fieldType: dto.fieldType,
        organizationId: testOrg.id,
        createdById: testUser.id,
        tableName: 'deals',
        isRequired: false,
        config: {},
      });
    });

    it('creates column for contacts entity', async () => {
      const dto = getMockDto();
      const result = await service.createColumn('contacts', testOrg.id, testUser.id, dto);

      expect(result).toBeDefined();
      expect(result.columnKey).toBe(dto.columnKey);

      const dbColumn = await prisma.tableColumn.findUnique({
        where: {
          organizationId_tableName_columnKey: {
            organizationId: testOrg.id,
            tableName: 'contacts',
            columnKey: dto.columnKey,
          },
        },
      });

      expect(dbColumn).toBeDefined();
      expect(dbColumn).toMatchObject({
        label: dto.label,
        columnKey: dto.columnKey,
        fieldType: dto.fieldType,
        organizationId: testOrg.id,
        createdById: testUser.id,
        tableName: 'contacts',
        isRequired: false,
        config: {},
      });
    });

    it('creates column for companies entity', async () => {
      const dto = getMockDto();
      const result = await service.createColumn('companies', testOrg.id, testUser.id, dto);
      
      expect(result).toBeDefined();
      expect(result.columnKey).toBe(dto.columnKey);

      const dbColumn = await prisma.tableColumn.findUnique({
        where: {
          organizationId_tableName_columnKey: {
            organizationId: testOrg.id,
            tableName: 'companies',
            columnKey: dto.columnKey,
          },
        },
      });

      expect(dbColumn).toBeDefined();
      expect(dbColumn).toMatchObject({
        label: dto.label,
        columnKey: dto.columnKey,
        fieldType: dto.fieldType,
        organizationId: testOrg.id,
        createdById: testUser.id,
        tableName: 'companies',
        isRequired: false,
        config: {},
      });
    });

    describe('when invalid request body provided', () => {
      it('throws error if dto is missing required fields', async () => {
        await expect(
          service.createColumn('deals', testOrg.id, testUser.id, { label: '' } as unknown as CreateColumnDto  ),
        ).rejects.toThrow('Invalid request body');

        await expect(
          service.createColumn('deals', testOrg.id, testUser.id, { columnKey: '' } as unknown as CreateColumnDto),
        ).rejects.toThrow('Invalid request body');

        await expect(
          service.createColumn('deals', testOrg.id, testUser.id, { fieldType: '' } as unknown as CreateColumnDto),
        ).rejects.toThrow('Invalid request body');
      });
    });

    describe('when invalid entity provided', () => {
      it('throws error for unsupported entity', async () => {
        await expect(
          service.createColumn('invalid', testOrg.id, testUser.id, getMockDto()),
        ).rejects.toThrow('Invalid entity');
      });
    });

    describe('when invalid field type provided', () => {
      it('throws error for unknown field type', async () => {
        await expect(
          service.createColumn('deals', testOrg.id, testUser.id, {
            ...getMockDto(),
            fieldType: 'unknown' as unknown as ColumnType,
          }),
        ).rejects.toThrow('Invalid field type');
      });
    });

    describe('when invalid column key provided', () => {
      it('throws error if column key contains restricted characters', async () => {
        await expect(
          service.createColumn('deals', testOrg.id, testUser.id, {
            ...getMockDto(),
            columnKey: 'Invalid-Key!',
          }),
        ).rejects.toThrow(
          'Column key must contain only lowercase letters, numbers, and underscores',
        );
      });
    });

    describe('when column key already exists', () => {
      it('throws error if key is reserved (default column)', async () => {
        const reservedKey = 'website';
        await expect(
          service.createColumn('companies', testOrg.id, testUser.id, {
            ...getMockDto(),
            columnKey: reservedKey,
          }),
        ).rejects.toThrow('Column key already exists');
      });

      it('throws error if key already exists as custom column', async () => {
        const dto = getMockDto();
        // Create it first
        await service.createColumn('deals', testOrg.id, testUser.id, dto);
        
        // Try to create it again with same column key
        await expect(
          service.createColumn('deals', testOrg.id, testUser.id, dto),
        ).rejects.toThrow('Column key already exists');
      });
    });

    it('throws error for any other repository errors', async () => {
      await expect(
        service.createColumn('deals', testOrg.id, 999999, getMockDto()),
      ).rejects.toThrow('Failed to create column');
    });
  });

  describe('buildMergedTable', () => {
    it('builds merged table with default columns and custom columns', async () => {
      const uniqueKey = `field_${Date.now()}`;
      await prisma.tableColumn.create({
        data: {
          organizationId: testOrg.id,
          tableName: 'contacts',
          columnKey: uniqueKey,
          label: 'Custom Field',
          fieldType: 'text',
          createdById: testUser.id,
          isRequired: false,
          config: {},
          createdAt: new Date(),
        },
      });

      await service.getContactsTable(testOrg.id, {});
    });
  });

  describe('updateCell', () => {
    it('updates a default column for a contact', async () => {
      const contact = await prisma.contact.create({
        data: {
          organizationId: testOrg.id,
          name: 'Original Name',
          email: `test-${Date.now()}@test.com`,
          createdAt: new Date(),
        },
      });

      const dto: UpdateCellDto = {
        columnId: 'name',
        value: 'Updated Name',
      };

      await service.updateCell('contacts', contact.id, testOrg.id, testUser.id, dto);

      const dbContact = await prisma.contact.findUnique({ where: { id: contact.id } });
      expect(dbContact?.name).toBe('Updated Name');
    });

    it('updates a custom column for a contact', async () => {
      const columnKey = `source_${Date.now()}`;
      await service.createColumn('contacts', testOrg.id, testUser.id, {
        label: 'Source',
        columnKey,
        fieldType: 'text' as ColumnType,
      });

      const contact = await prisma.contact.create({
        data: {
          organizationId: testOrg.id,
          name: 'Contact With Custom Field',
          email: `test-${Date.now()}@test.com`,
          fields: { [columnKey]: 'Old Source' },
          createdAt: new Date(),
        },
      });

      const dto: UpdateCellDto = {
        columnId: columnKey,
        value: 'New Source',
      };

      await service.updateCell('contacts', contact.id, testOrg.id, testUser.id, dto);

      const dbContact = await prisma.contact.findUnique({ where: { id: contact.id } });
      expect((dbContact?.fields as Record<string, unknown>)[columnKey]).toBe('New Source');
    });

    it('updates a default column for a company', async () => {
      const company = await prisma.company.create({
        data: {
          organizationId: testOrg.id,
          companyName: 'Original Company',
          createdAt: new Date(),
        },
      });

      const dto: UpdateCellDto = {
        columnId: 'companyName',
        value: 'Updated Company',
      };

      await service.updateCell('companies', company.id, testOrg.id, testUser.id, dto);

      const dbCompany = await prisma.company.findUnique({ where: { id: company.id } });
      expect(dbCompany?.companyName).toBe('Updated Company');
    });

    it('updates a custom column for a company', async () => {
      const columnKey = `industry_${Date.now()}`;
      await service.createColumn('companies', testOrg.id, testUser.id, {
        label: 'Industry',
        columnKey,
        fieldType: 'text' as ColumnType,
      });

      const company = await prisma.company.create({
        data: {
          organizationId: testOrg.id,
          companyName: 'Company With Custom Field',
          fields: { [columnKey]: 'Old Industry' },
          createdAt: new Date(),
        },
      });

      const dto: UpdateCellDto = {
        columnId: columnKey,
        value: 'New Industry',
      };

      await service.updateCell('companies', company.id, testOrg.id, testUser.id, dto);

      const dbCompany = await prisma.company.findUnique({ where: { id: company.id } });
      expect((dbCompany?.fields as Record<string, unknown>)[columnKey]).toBe('New Industry');
    });

    it('updates a default column for a deal', async () => {
      const deal = await prisma.deal.create({
        data: {
          organizationId: testOrg.id,
          title: 'Original Deal',
          value: 100,
          stage: 'prospecting',
          createdAt: new Date(),
        },
      });

      const dto: UpdateCellDto = {
        columnId: 'title',
        value: 'Updated Deal',
      };

      await service.updateCell('deals', deal.id, testOrg.id, testUser.id, dto);

      const dbDeal = await prisma.deal.findUnique({ where: { id: deal.id } });
      expect(dbDeal?.title).toBe('Updated Deal');
    });

    it('updates a custom column for a deal', async () => {
      const columnKey = `score_${Date.now()}`;
      await service.createColumn('deals', testOrg.id, testUser.id, {
        label: 'Score',
        columnKey,
        fieldType: 'number' as ColumnType,
      });

      const deal = await prisma.deal.create({
        data: {
          organizationId: testOrg.id,
          title: 'Deal With Custom Field',
          fields: { [columnKey]: 10 },
          stage: 'prospecting',
          createdAt: new Date(),
        },
      });

      const dto: UpdateCellDto = {
        columnId: columnKey,
        value: 20,
      };

      await service.updateCell('deals', deal.id, testOrg.id, testUser.id, dto);

      const dbDeal = await prisma.deal.findUnique({ where: { id: deal.id } });
      expect((dbDeal?.fields as Record<string, unknown>)[columnKey]).toBe(20);
    });

    it('throws error when updating a custom column that does not exist', async () => {
      const contact = await prisma.contact.create({
        data: {
          organizationId: testOrg.id,
          name: 'Test Contact',
          email: `test-${Date.now()}@test.com`,
          createdAt: new Date(),
        },
      });

      await expect(
        service.updateCell('contacts', contact.id, testOrg.id, testUser.id, {
          columnId: 'non_existent_column',
          value: 'value',
        }),
      ).rejects.toThrow('Column not found');
    });

    it('throws error for unsupported entity', async () => {
      await expect(
        service.updateCell('unsupported', 1, testOrg.id, testUser.id, {
          columnId: 'any',
          value: 'any',
        }),
      ).rejects.toThrow('Entity unsupported not supported for cell update');
    });
  });
});
