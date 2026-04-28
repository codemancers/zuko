import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import type { Contact, TableColumn, User } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ContactsService } from './contacts.service';
import { ContactsRepository } from '../repositories/contacts.repository';
import { TableColumnRepository } from '../repositories/table-column.repository';

describe('ContactsService', () => {
  let service: ContactsService;
  let prisma: PrismaClient;
  const ORG_ID = 999_002;
  const TEST_USER_EMAIL = `test-actor-1-${ORG_ID}@example.com`;
  let column1: TableColumn;
  let user: User;
  let contact: Contact;

  beforeAll(async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');

    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
    await prisma.$connect();

    const module = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        ContactsService,
        {
          provide: ContactsRepository,
          useFactory: (p) => new ContactsRepository(p),
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

    service = module.get(ContactsService);

    // 3. Seed initial data
    await prisma.organization.upsert({
      where: { id: ORG_ID },
      update: {},
      create: {
        id: ORG_ID,
        name: 'Test Org Contacts',
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
        tableName: 'contacts',
        columnKey: 'lead_source',
        label: 'Lead Source',
        fieldType: 'select',
        config: {
          options: [
            { label: 'Web', value: 'web' },
            { label: 'Referral', value: 'referral' },
          ],
        },
      },
    });

    contact = await service.create(
      {
        organizationId: ORG_ID,
        name: 'Jane Doe',
        email: `jane-${ORG_ID}@example.com`,
      },
      user.id,
    );
  });

  afterAll(async () => {
    try {
      await prisma.dealContact.deleteMany({
        where: { contact: { organizationId: ORG_ID } },
      });
      await prisma.companyContact.deleteMany({
        where: { contact: { organizationId: ORG_ID } },
      });
      await prisma.contactOwner.deleteMany({
        where: { contact: { organizationId: ORG_ID } },
      });
      await prisma.contact.deleteMany({ where: { organizationId: ORG_ID } });
      await prisma.tableColumn.deleteMany({
        where: { organizationId: ORG_ID, tableName: 'contacts' },
      });
      await prisma.organization.deleteMany({ where: { id: ORG_ID } });
      await prisma.user.deleteMany({ where: { email: TEST_USER_EMAIL } });
    } catch (e) {
      console.warn('Cleanup failed:', e);
    }

    await prisma.$disconnect();
  });

  describe('create and update', () => {
    it('creates a contact and updates its custom select field', async () => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: TEST_USER_EMAIL },
      });

      expect(contact.id).toBeDefined();
      expect(contact.name).toBe('Jane Doe');

      // 2. Update with valid option
      await service.update(
        contact.id,
        ORG_ID,
        { fields: { [column1.columnKey]: 'web' } },
        user.id,
      );

      const updated = await prisma.contact.findUnique({
        where: { id: contact.id },
      });
      expect(
        (updated!.fields as Record<string, unknown>)[column1.columnKey],
      ).toBe('web');

      // 3. Update with invalid option should fail
      await expect(
        service.update(
          contact.id,
          ORG_ID,
          { fields: { [column1.columnKey]: 'invalid_source' } },
          user.id,
        ),
      ).rejects.toThrow('Invalid option "invalid_source" for select field');
    });
  });
});
