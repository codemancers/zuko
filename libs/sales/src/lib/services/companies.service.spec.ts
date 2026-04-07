import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Company, PrismaClient, TableColumn, User } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { CompaniesService } from './companies.service';
import { CompaniesRepository } from '../repositories/companies.repository';
import { TableColumnRepository } from '../repositories/table-column.repository';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let prisma: PrismaClient;
  let pool: Pool;

  const ORG_ID = 999_001;
  const TEST_USER_EMAIL = `test-actor-1-${ORG_ID}@example.com`;
  let company1: Company;
  let column1: TableColumn;
  let user: User;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    pool = new Pool({ connectionString });
    prisma = new PrismaClient({
      adapter: new PrismaPg(pool),
    });
    await prisma.$connect();

    // 2. Setup NestJS Module
    const module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        CompaniesService,
        {
          provide: CompaniesRepository,
          useFactory: (p) => new CompaniesRepository(p),
          inject: ['PrismaService'],
        },
        {
          provide: TableColumnRepository,
          useFactory: (p) => new TableColumnRepository(p),
          inject: ['PrismaService'],
        },
        {
          provide: 'PrismaService',
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get(CompaniesService);

    // 3. Seed initial data
    await prisma.organization.upsert({
      where: { id: ORG_ID },
      update: {},
      create: {
        id: ORG_ID,
        name: 'Test Org',
        slug: `test-org-${ORG_ID}`,
        createdAt: new Date(),
      },
    });

    user = await prisma.user.upsert({
      where: { email: TEST_USER_EMAIL },
      update: {},
      create: {
        name: `user-1-${ORG_ID}`,
        email: TEST_USER_EMAIL,
      },
    });

    column1 = await prisma.tableColumn.create({
      data: {
        organizationId: ORG_ID,
        createdById: user.id,
        tableName: 'companies',
        columnKey: 'company_tier',
        label: 'Company Tier',
        fieldType: 'select',
        config: {
          options: [
            { label: 'Starter', value: 'starter' },
            { label: 'Growth', value: 'growth' },
            { label: 'Enterprise', value: 'enterprise' },
          ],
        },
      },
    });

    company1 = await prisma.company.create({
      data: {
        organizationId: ORG_ID,
        companyName: 'Acme Corp',
      },
    });
  });

  afterAll(async () => {
    try {
      await prisma.companyContact.deleteMany({ where: { company: { organizationId: ORG_ID } } });
      await prisma.companyOwner.deleteMany({ where: { company: { organizationId: ORG_ID } } });
      await prisma.company.deleteMany({ where: { organizationId: ORG_ID } });
      await prisma.tableColumn.deleteMany({ where: { organizationId: ORG_ID } });
      await prisma.organization.deleteMany({ where: { id: ORG_ID } });
      await prisma.user.deleteMany({ where: { email: TEST_USER_EMAIL } });
    } catch (e) {
      console.warn('Cleanup failed:', e);
    }

    await prisma.$disconnect();
    await pool.end();
  });

  describe('update custom fields', () => {
    it('persists a valid select option', async () => {
      // 1. Update with valid option
      await service.update(
        company1.id,
        ORG_ID,
        { fields: { [column1.columnKey]: 'growth' } },
        user.id,
      );

      // 2. Verify
      const updated = await prisma.company.findUnique({ where: { id: company1.id } });
      const fields = updated?.fields as Record<string, unknown>;
      expect(fields[column1.columnKey]).toBe('growth');
    });

    it('rejects an invalid select option', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { email: TEST_USER_EMAIL } });
      
      await expect(
        service.update(
          company1.id,
          ORG_ID,
          { fields: { [column1.columnKey]: 'invalid_option' } },
          user.id,
        ),
      ).rejects.toThrow('Invalid option "invalid_option" for select field');
    });
  });
});
