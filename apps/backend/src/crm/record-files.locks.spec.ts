import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../generated/prisma/client';
import { runInTenant } from '../prisma/tenant-transaction';
import type { RequestContext } from './context';
import { RecordFilesService } from './record-files.service';

config({ path: resolve(__dirname, '../../../../.env'), quiet: true });

const url = process.env.TEST_DATABASE_URL;
const LOCK_TIMEOUT = /lock timeout|55P03/i;

// Real-database test; see core-data-model.spec.ts for how to set TEST_DATABASE_URL.
describe.skipIf(!url)('file locks', () => {
  const prisma = url ? new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) }) : (undefined as never);
  const suffix = Math.random().toString(36).slice(2, 8);
  const files = new RecordFilesService();
  let org: bigint;
  let user: bigint;
  let first: bigint;
  let second: bigint;
  const ctx = (): RequestContext => ({ organizationId: org, userId: user, roles: ['member'], teamIds: [], requestId: 't', actorType: 'USER' });
  const inOrg = <T>(fn: Parameters<typeof runInTenant<T>>[2]) => runInTenant(prisma, { organizationId: org }, fn);

  beforeAll(async () => {
    await prisma.$connect();
    org = (await prisma.organization.create({ data: { name: 'Locks', slug: `lk-${suffix}` } })).id;
    user = (await prisma.user.create({ data: { name: 'u', email: `lock-${suffix}@example.com` } })).id;
    const file = (n: number) =>
      inOrg((tx) =>
        tx.storedFile.create({ data: { organizationId: org, uploadedBy: user, filename: `f${n}.pdf`, mediaType: 'application/pdf', size: 1, sha256: 'x', storageKey: `${org}/lock-${suffix}-${n}` } }),
      ).then((f) => f.id);
    first = await file(1);
    second = await file(2);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: org } });
    await prisma.user.deleteMany({ where: { id: user } });
    await prisma.$disconnect();
  });

  /** Hold a lock inside an open transaction until `release()` is called. */
  function hold(mode: 'attach' | 'delete', ids: bigint[] = [first]) {
    let release!: () => void;
    let locked!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    const acquired = new Promise<void>((resolve) => (locked = resolve));
    const done = inOrg(async (tx) => {
      await files.lockFiles(tx, ctx(), ids, mode);
      locked();
      await released;
    });
    return { acquired, release: () => (release(), done) };
  }
  /** Try to take a lock, giving up quickly when someone else holds a conflicting one. */
  const tryLock = (mode: 'attach' | 'delete', ids: bigint[] = [first]) =>
    inOrg(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '300ms'");
      await files.lockFiles(tx, ctx(), ids, mode);
    });

  it('lets several attachments of one file proceed together', async () => {
    const holder = hold('attach');
    await holder.acquired;
    await expect(tryLock('attach')).resolves.toBeUndefined();
    await holder.release();
  });

  it('makes a delete wait for an attachment in progress, then lets it through', async () => {
    const holder = hold('attach');
    await holder.acquired;
    await expect(tryLock('delete')).rejects.toThrow(LOCK_TIMEOUT);
    await holder.release();
    await expect(tryLock('delete')).resolves.toBeUndefined();
  });

  it('makes an attachment wait for a delete in progress', async () => {
    const holder = hold('delete');
    await holder.acquired;
    await expect(tryLock('attach')).rejects.toThrow(LOCK_TIMEOUT);
    await holder.release();
  });

  it('does not touch other files, or other writers locking the same files in another order', async () => {
    const holder = hold('delete', [first]);
    await holder.acquired;
    await expect(tryLock('attach', [second])).resolves.toBeUndefined();
    await holder.release();
    // Two writers naming the same two files in opposite orders would deadlock without a fixed lock order.
    await expect(Promise.all([tryLock('attach', [first, second]), tryLock('attach', [second, first])])).resolves.toBeDefined();
    await expect(Promise.all([tryLock('delete', [first, second]), tryLock('delete', [second, first])])).resolves.toBeDefined();
  });
});
