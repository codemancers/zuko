import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { Contact, Organization, Prospect } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TaskRepository } from './task.repository';
import { ContactsRepository } from './contacts.repository';
import { ProspectsRepository } from './prospects.repository';
import { TaskService } from '../services/task.service';
import type { PrismaService } from '../modules/prisma.types';

// Exercises the real repository transactions against a migrated database.
// Requires DATABASE_URL pointing at a disposable database with the
// task contact_id/prospect_id migration applied.
describe.skipIf(!process.env.DATABASE_URL)(
  'TaskRepository person reference (database)',
  () => {
    let prisma: PrismaClient;
    let repo: TaskRepository;
    let service: TaskService;
    let org: Organization;
    let otherOrg: Organization;
    let contact: Contact;
    let otherContact: Contact;
    let prospect: Prospect;
    let otherProspect: Prospect;
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const MISSING_ID = 2_000_000_000;

    const refsOf = async (taskId: number) =>
      prisma.task.findUniqueOrThrow({
        where: { id: taskId },
        select: { title: true, contactId: true, prospectId: true },
      });

    beforeAll(async () => {
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
      });
      await prisma.$connect();
      repo = new TaskRepository(prisma as unknown as PrismaService);
      service = new TaskService(repo, {
        emitAsync: async () => [],
      } as unknown as EventEmitter2);

      const mkOrg = (key: string) =>
        prisma.organization.create({
          data: {
            name: `Person Ref ${key} ${suffix}`,
            slug: `person-ref-${key}-${suffix}`,
            createdAt: new Date(),
          },
        });
      org = await mkOrg('org');
      otherOrg = await mkOrg('other');

      contact = await prisma.contact.create({
        data: {
          organizationId: org.id,
          name: `Contact ${suffix}`,
          email: `contact-${suffix}@example.com`,
        },
      });
      otherContact = await prisma.contact.create({
        data: { organizationId: otherOrg.id, name: `Foreign ${suffix}` },
      });
      // Already resolved to `contact`; tasks must still never infer one from the other.
      prospect = await prisma.prospect.create({
        data: {
          organizationId: org.id,
          name: `Prospect ${suffix}`,
          email: `prospect-${suffix}@example.com`,
          contactId: contact.id,
        },
      });
      otherProspect = await prisma.prospect.create({
        data: { organizationId: otherOrg.id, name: `Foreign P ${suffix}` },
      });
    });

    afterAll(async () => {
      if (!prisma) return;
      try {
        const orgIds = [org?.id, otherOrg?.id].filter(Boolean) as number[];
        await prisma.task.deleteMany({
          where: { organizationId: { in: orgIds }, parentId: { not: null } },
        });
        await prisma.task.deleteMany({
          where: { organizationId: { in: orgIds } },
        });
        // Contacts and prospects cascade from their organization.
        await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
      } finally {
        await prisma.$disconnect();
      }
    });

    it('creates with a contact and reads it back on detail and list with an id/name summary only', async () => {
      const created = await service.createTask(org.id, {
        title: 'Linked contact',
        contactId: contact.id,
      });
      expect(created.contactId).toBe(contact.id);
      expect(created.prospectId).toBeNull();
      expect(created.contact).toEqual({ id: contact.id, name: contact.name });
      expect(created.prospect).toBeNull();

      const detail = await service.getTaskById(org.id, created.id);
      expect(detail.contact).toEqual({ id: contact.id, name: contact.name });

      const { tasks } = await service.getTasks(org.id, {
        search: 'Linked contact',
      });
      const listed = tasks.find((t) => t.id === created.id);
      expect(listed?.contactId).toBe(contact.id);
      expect(listed?.contact).toEqual({ id: contact.id, name: contact.name });
      expect(listed?.prospect).toBeNull();
    });

    it('creates with a prospect and never converts it to its matched contact', async () => {
      const created = await repo.create({
        organizationId: org.id,
        title: 'Linked prospect',
        prospectId: prospect.id,
      });
      expect(created.prospectId).toBe(prospect.id);
      expect(created.contactId).toBeNull();
      expect(created.prospect).toEqual({
        id: prospect.id,
        name: prospect.name,
      });
      expect(created.contact).toBeNull();
    });

    it('creates without a reference when both are omitted', async () => {
      const created = await repo.create({
        organizationId: org.id,
        title: 'No reference',
      });
      expect(created.contactId).toBeNull();
      expect(created.prospectId).toBeNull();
      expect(created.contact).toBeNull();
      expect(created.prospect).toBeNull();
    });

    it('replaces one kind of reference with the other, preserves on omission, and clears on null', async () => {
      const task = await repo.create({
        organizationId: org.id,
        title: 'Replace',
        contactId: contact.id,
      });

      const toProspect = await repo.update(task.id, org.id, {
        prospectId: prospect.id,
      });
      expect(toProspect.prospectId).toBe(prospect.id);
      expect(toProspect.contactId).toBeNull();

      const untouched = await service.updateTask(org.id, task.id, {
        title: 'Replace renamed',
      });
      expect(untouched.prospectId).toBe(prospect.id);
      expect(untouched.contactId).toBeNull();

      const toContact = await repo.update(task.id, org.id, {
        contactId: contact.id,
      });
      expect(toContact.contactId).toBe(contact.id);
      expect(toContact.prospectId).toBeNull();

      const clearedProspectOnly = await repo.update(task.id, org.id, {
        prospectId: null,
      });
      expect(clearedProspectOnly.contactId).toBe(contact.id);

      const cleared = await repo.update(task.id, org.id, { contactId: null });
      expect(cleared.contactId).toBeNull();
      expect(cleared.contact).toBeNull();

      await repo.update(task.id, org.id, { prospectId: prospect.id });
      const clearedAll = await repo.update(task.id, org.id, {
        contactId: null,
        prospectId: null,
      });
      expect(clearedAll.contactId).toBeNull();
      expect(clearedAll.prospectId).toBeNull();
      expect(clearedAll.title).toBe('Replace renamed');
    });

    it('rejects both references even when the prospect maps to that contact, writing nothing', async () => {
      const task = await repo.create({
        organizationId: org.id,
        title: 'Both',
        contactId: contact.id,
      });

      await expect(
        service.updateTask(org.id, task.id, {
          title: 'Both changed',
          contactId: contact.id,
          prospectId: prospect.id,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        repo.create({
          organizationId: org.id,
          title: 'Both create',
          contactId: contact.id,
          prospectId: prospect.id,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(await refsOf(task.id)).toEqual({
        title: 'Both',
        contactId: contact.id,
        prospectId: null,
      });
      expect(
        await prisma.task.count({
          where: { organizationId: org.id, title: 'Both create' },
        }),
      ).toBe(0);
    });

    it.each([
      ['foreign contact', () => ({ contactId: otherContact.id })],
      ['foreign prospect', () => ({ prospectId: otherProspect.id })],
      ['nonexistent contact', () => ({ contactId: MISSING_ID })],
      ['nonexistent prospect', () => ({ prospectId: MISSING_ID })],
    ])('rejects a %s and rolls back the other fields', async (label, refs) => {
      const task = await repo.create({
        organizationId: org.id,
        title: `Rollback ${label}`,
        prospectId: prospect.id,
      });

      await expect(
        service.updateTask(org.id, task.id, {
          title: 'Should not persist',
          isSales: true,
          ...refs(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createTask(org.id, {
          title: `Rejected create ${label}`,
          ...refs(),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(await refsOf(task.id)).toEqual({
        title: `Rollback ${label}`,
        contactId: null,
        prospectId: prospect.id,
      });
      const after = await repo.findById(task.id, org.id);
      expect(after?.isSales).toBe(false);
      expect(
        await prisma.task.count({
          where: { title: `Rejected create ${label}` },
        }),
      ).toBe(0);
    });

    it('ignores caller-supplied nested relation operations that would bypass org validation', async () => {
      // The controller spreads the request body into the service at runtime,
      // so these keys can reach the repository despite the static types.
      const created = await service.createTask(org.id, {
        title: 'Injected create',
        contact: { connect: { id: otherContact.id } },
        prospect: { connect: { id: otherProspect.id } },
      } as never);
      expect(await refsOf(created.id)).toEqual({
        title: 'Injected create',
        contactId: null,
        prospectId: null,
      });

      const updated = await service.updateTask(org.id, created.id, {
        title: 'Injected update',
        contact: { connect: { id: otherContact.id } },
        prospect: {
          create: { organizationId: otherOrg.id, name: `Injected ${suffix}` },
        },
        organizationId: otherOrg.id,
      } as never);
      expect(updated.organizationId).toBe(org.id);
      expect(await refsOf(created.id)).toEqual({
        title: 'Injected update',
        contactId: null,
        prospectId: null,
      });
      expect(
        await prisma.prospect.count({ where: { name: `Injected ${suffix}` } }),
      ).toBe(0);
    });

    it('links a hidden contact, matching contact detail access within the organization', async () => {
      const hidden = await prisma.contact.create({
        data: {
          organizationId: org.id,
          name: `Hidden ${suffix}`,
          isHidden: true,
        },
      });
      const task = await repo.create({
        organizationId: org.id,
        title: 'Hidden link',
        contactId: hidden.id,
      });
      expect(task.contact).toEqual({ id: hidden.id, name: hidden.name });
    });

    it('keeps the task and nulls the link when the person is deleted', async () => {
      const doomedContact = await prisma.contact.create({
        data: { organizationId: org.id, name: `Doomed C ${suffix}` },
      });
      const doomedProspect = await prisma.prospect.create({
        data: { organizationId: org.id, name: `Doomed P ${suffix}` },
      });
      const withContact = await repo.create({
        organizationId: org.id,
        title: 'Survives contact delete',
        contactId: doomedContact.id,
      });
      const withProspect = await repo.create({
        organizationId: org.id,
        title: 'Survives prospect delete',
        prospectId: doomedProspect.id,
      });

      await prisma.contact.delete({ where: { id: doomedContact.id } });
      await prisma.prospect.delete({ where: { id: doomedProspect.id } });

      expect(await refsOf(withContact.id)).toEqual({
        title: 'Survives contact delete',
        contactId: null,
        prospectId: null,
      });
      expect(await refsOf(withProspect.id)).toEqual({
        title: 'Survives prospect delete',
        contactId: null,
        prospectId: null,
      });
    });

    it('enforces a single reference in the database itself', async () => {
      const task = await repo.create({
        organizationId: org.id,
        title: 'Check constraint',
      });
      await expect(
        prisma.task.update({
          where: { id: task.id },
          data: { contactId: contact.id, prospectId: prospect.id },
        }),
      ).rejects.toThrow();
      expect(await refsOf(task.id)).toEqual({
        title: 'Check constraint',
        contactId: null,
        prospectId: null,
      });
    });

    it('reads tasks written without references as having none', async () => {
      const legacy = await prisma.task.create({
        data: { organizationId: org.id, title: 'Pre-existing task' },
      });
      const read = await repo.findById(legacy.id, org.id);
      expect(read?.contactId).toBeNull();
      expect(read?.prospectId).toBeNull();
      expect(read?.contact).toBeNull();
      expect(read?.prospect).toBeNull();
    });

    it('creating a contact or prospect never creates a task', async () => {
      const before = await prisma.task.count({
        where: { organizationId: org.id },
      });
      const contacts = new ContactsRepository(
        prisma as unknown as PrismaService,
      );
      const prospects = new ProspectsRepository(
        prisma as unknown as PrismaService,
      );
      await contacts.create({
        organizationId: org.id,
        name: `Fresh C ${suffix}`,
      });
      await prospects.create({
        organizationId: org.id,
        name: `Fresh P ${suffix}`,
      });
      expect(
        await prisma.task.count({ where: { organizationId: org.id } }),
      ).toBe(before);
    });
  },
);
