import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { EventEmitterModule, EventEmitter2 } from '@nestjs/event-emitter';
import type { Company, TableColumn, User } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { CompaniesService } from './companies.service';
import { CompaniesRepository } from '../repositories/companies.repository';
import { TableColumnRepository } from '../repositories/table-column.repository';
import { COMPANY_EVENTS } from '../events/company-events';
import type { CompanyFieldUpdatedEvent } from '../events/company-events';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let prisma: PrismaClient;
  let eventEmitter: EventEmitter2;
  const ORG_ID = 999_001;
  const TEST_USER_EMAIL = `test-actor-1-${ORG_ID}@example.com`;
  let company1: Company;
  let column1: TableColumn;
  let user: User;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
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
    eventEmitter = module.get(EventEmitter2);

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
      await prisma.companyContact.deleteMany({
        where: { company: { organizationId: ORG_ID } },
      });
      await prisma.companyOwner.deleteMany({
        where: { company: { organizationId: ORG_ID } },
      });
      await prisma.company.deleteMany({ where: { organizationId: ORG_ID } });
      await prisma.tableColumn.deleteMany({
        where: { organizationId: ORG_ID },
      });
      await prisma.organization.deleteMany({ where: { id: ORG_ID } });
      await prisma.user.deleteMany({ where: { email: TEST_USER_EMAIL } });
    } catch (e) {
      console.warn('Cleanup failed:', e);
    }

    await prisma.$disconnect();
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
      const updated = await prisma.company.findUnique({
        where: { id: company1.id },
      });
      const fields = updated?.fields as Record<string, unknown>;
      expect(fields[column1.columnKey]).toBe('growth');
    });

    it('rejects an invalid select option', async () => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: TEST_USER_EMAIL },
      });

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

  describe('field_update events for object-valued fields', () => {
    it('emits field_update when summary content actually changes', async () => {
      const events: CompanyFieldUpdatedEvent[] = [];
      const handler = (event: CompanyFieldUpdatedEvent) => events.push(event);
      eventEmitter.on(COMPANY_EVENTS.FIELD_UPDATED, handler);

      try {
        await service.update(
          company1.id,
          ORG_ID,
          {
            summary: { blocks: [{ type: 'paragraph', data: { text: 'v1' } }] },
          },
          user.id,
        );

        const summaryEvents = events.filter((e) => e.field === 'summary');
        expect(summaryEvents).toHaveLength(1);
      } finally {
        eventEmitter.off(COMPANY_EVENTS.FIELD_UPDATED, handler);
      }
    });

    it('does not emit field_update when re-saving an unchanged summary', async () => {
      const summary = {
        blocks: [{ type: 'paragraph', data: { text: 'stable' } }],
      };
      await service.update(company1.id, ORG_ID, { summary }, user.id);

      const events: CompanyFieldUpdatedEvent[] = [];
      const handler = (event: CompanyFieldUpdatedEvent) => events.push(event);
      eventEmitter.on(COMPANY_EVENTS.FIELD_UPDATED, handler);

      try {
        // Same content, distinct object reference — value comparison, not
        // reference comparison, must treat this as a no-op.
        await service.update(
          company1.id,
          ORG_ID,
          { summary: JSON.parse(JSON.stringify(summary)) },
          user.id,
        );

        expect(events.filter((e) => e.field === 'summary')).toHaveLength(0);
      } finally {
        eventEmitter.off(COMPANY_EVENTS.FIELD_UPDATED, handler);
      }
    });
  });
});
