import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, withDb, type Reply } from '../support/crm-client';

/**
 * File uploads over real HTTP.
 *   Acme: owner and alice (a member who did not upload the file)
 *   Other: carol, in another organization
 */
const run = Date.now().toString(36);
const suffix = `-${run}@files.test`;
const slugs = [`files-acme-${run}`, `files-other-${run}`];
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');
const carol = mk('carol');
const API = '/api/v1/files';

const ok = (reply: Reply, status = 200) => {
  if (reply.status !== status) throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  return reply.data;
};
const pdf = Buffer.from('%PDF-1.7 e2e file contents');
// A minimal real .xlsx: a zip whose [Content_Types].xml and xl/ entries make it an Excel workbook.
const XLSX = Buffer.from('UEsDBBQAAAAIAHSIel10vYL2rgAAAOkAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbF2PsQ7CMAxEf6XKihoXBgbUloEdGPgBk7o0ahNHiSnl70lhYzpZp3t3ro+Lm4qZYrLsG7XVlTq29e0dKBXZ8alRg0g4ACQzkMOkOZDPTs/RoeQzPiCgGfFBsKuqPRj2Ql5KWRmqrS8ZHm1HxRWjnNFRo2CZ4MVxvDOPOrNUcfqF1t5GYQiTNSh5Ecy++2ssue+toY7N0+WITiESdmkgEjfpr2qH1m9WMLQ1fJ9pP1BLAwQUAAAACAB0iHpdKFH52VwAAABqAAAACwAAAF9yZWxzLy5yZWxzTYzLDYAgEAVbIRTgogcPhk8PdrAhqxj5hSXG8uXo8c1MnnZviuKhxlfJRs6Tks7qnSL2AThclcUoMhsZeq8bAPtACXkqlfIwR2kJ+5jthIr+xpNgUWqF9v+QYD9QSwMEFAAAAAgAdIh6Xc6emBMNAAAACwAAAA8AAAB4bC93b3JrYm9vay54bWyzKc8vyk7Kz8/WtwMAUEsBAhQDFAAAAAgAdIh6XXS9gvauAAAA6QAAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAMUAAAACAB0iHpdKFH52VwAAABqAAAACwAAAAAAAAAAAAAAgAHfAAAAX3JlbHMvLnJlbHNQSwECFAMUAAAACAB0iHpdzp6YEw0AAAALAAAADwAAAAAAAAAAAAAAgAFkAQAAeGwvd29ya2Jvb2sueG1sUEsFBgAAAAADAAMAtwAAAJ4BAAAAAA==', 'base64');
const MB = 1024 * 1024;
let org: string;

const fileCount = () =>
  withDb(async (db) => (await db.query('SELECT count(*)::int AS n FROM stored_file WHERE "organization_id" = $1', [org])).rows[0].n as number);

beforeAll(async () => {
  for (const user of [owner, alice, carol]) ok(await user.signUp());
  await verifyEmails(suffix);
  org = ok(await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] })).id;
  const invite = ok(await owner.post('/auth/organization/invite-member', { email: alice.email, role: 'member', organizationId: org }));
  ok(await alice.post('/auth/organization/accept-invitation', { invitationId: invite.id }));
  ok(await alice.signIn());
  ok(await carol.post('/auth/organization/create', { name: 'Other', slug: slugs[1] }));
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60_000);

describe('uploading and downloading', () => {
  it('round-trips the bytes and reports only safe metadata', async () => {
    const file = ok(await owner.upload(API, 'contract.pdf', pdf, 'application/pdf'), 201);
    expect(file).toMatchObject({ filename: 'contract.pdf', media_type: 'application/pdf', size: pdf.length, uploaded_by: owner.id });
    expect(Object.keys(file).sort()).toEqual(['created_at', 'filename', 'id', 'media_type', 'size', 'uploaded_by']);
    expect(ok(await owner.get(`${API}/${file.id}`))).toEqual(file);

    const down = await owner.download(`${API}/${file.id}/content`);
    expect(down.status).toBe(200);
    expect(down.bytes.equals(pdf)).toBe(true);
    expect(down.headers).toMatchObject({ 'content-type': 'application/pdf', 'x-content-type-options': 'nosniff', 'cache-control': 'private, no-store' });
    expect(down.headers?.['content-disposition']).toMatch(/^inline;/);
  });

  it('decides the type from the bytes, never from what the client claims, and downloads anything unsafe', async () => {
    const html = Buffer.from('<html><script>alert(1)</script></html>');
    const file = ok(await owner.upload(API, 'page.html', html, 'text/html'), 201);
    expect(file.media_type).toBe('application/octet-stream');
    const down = await owner.download(`${API}/${file.id}/content`);
    expect(down.headers?.['content-disposition']).toMatch(/^attachment;/);
    expect(down.headers?.['content-type']).toBe('application/octet-stream');

    const fake = ok(await owner.upload(API, 'photo.png', html, 'image/png'), 201);
    expect(fake.media_type).toBe('application/octet-stream');
  });

  it('recognizes an Office document by its contents, and still serves it as a download', async () => {
    const file = ok(await owner.upload(API, 'sheet.xlsx', XLSX, 'application/octet-stream'), 201);
    expect(file.media_type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const down = await owner.download(`${API}/${file.id}/content`);
    expect(down.bytes.equals(XLSX)).toBe(true);
    expect(down.headers?.['content-disposition']).toMatch(/^attachment;/);
  });

  it('sanitizes the filename', async () => {
    const file = ok(await owner.upload(API, '../../etc/passwd', pdf, 'application/pdf'), 201);
    expect(file.filename).toBe('passwd');
  });

  it('records who uploaded it in the audit log', async () => {
    const file = ok(await owner.upload(API, 'audited.pdf', pdf, 'application/pdf'), 201);
    const rows = await withDb(async (db) =>
      (await db.query(`SELECT "actor_type" AS "actorType", "actor_id"::text AS actor, metadata FROM audit_event WHERE event = 'file.uploaded' AND "target_id" = $1`, [file.id])).rows,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actorType: 'USER', actor: owner.id });
    expect(rows[0].metadata).toMatchObject({ filename: 'audited.pdf', size: pdf.length });
  });
});

describe('limits', () => {
  it('accepts a file of exactly 25 MB', async () => {
    const file = ok(await owner.upload(API, 'max.bin', Buffer.alloc(25 * MB, 1)), 201);
    expect(file.size).toBe(25 * MB);
  }, 60_000);

  it('rejects a file over 25 MB with 413 and keeps nothing', async () => {
    const before = await fileCount();
    const reply = await owner.upload(API, 'big.bin', Buffer.alloc(25 * MB + 1, 1));
    expect(reply.status).toBe(413);
    expect(await fileCount()).toBe(before);
  }, 60_000);

  it('rejects an empty file', async () => {
    const before = await fileCount();
    expect((await owner.upload(API, 'empty.txt', Buffer.alloc(0), 'text/plain')).status).toBe(400);
    expect(await fileCount()).toBe(before);
  });

  it('rejects a request with no file, the wrong field name, or extra text fields', async () => {
    expect((await owner.post(API, {})).status).toBeGreaterThanOrEqual(400);
    expect((await owner.upload(API, 'a.pdf', pdf, 'application/pdf', 'document')).status).toBeGreaterThanOrEqual(400);
    expect((await owner.upload(API, 'a.pdf', pdf, 'application/pdf', 'file', { note: 'x' })).status).toBeGreaterThanOrEqual(400);
  });
});

describe('who can see a file', () => {
  let id: string;
  beforeAll(async () => {
    id = ok(await owner.upload(API, 'private.pdf', pdf, 'application/pdf'), 201).id;
  });

  it('is invisible to a colleague who did not upload it, and to another organization', async () => {
    for (const other of [alice, carol]) {
      expect((await other.get(`${API}/${id}`)).status).toBe(404);
      expect((await other.download(`${API}/${id}/content`)).status).toBe(404);
      expect((await other.del(`${API}/${id}`)).status).toBe(404);
    }
    expect((await owner.get(`${API}/${id}`)).status).toBe(200); // the delete above changed nothing
  });

  it('needs a signed-in user', async () => {
    const anon = mk('anon');
    expect((await anon.get(`${API}/${id}`)).status).toBe(401);
    expect((await anon.upload(API, 'x.pdf', pdf, 'application/pdf')).status).toBe(401);
  });

  it('treats a malformed or unknown id as not found', async () => {
    for (const bad of ['abc', '0', '99999999999999999999', '-1']) {
      expect((await owner.get(`${API}/${bad}`)).status).toBe(404);
    }
  });
});

describe('deleting', () => {
  it('hides the file at once, and a second delete finds nothing', async () => {
    const id = ok(await owner.upload(API, 'gone.pdf', pdf, 'application/pdf'), 201).id;
    expect((await owner.del(`${API}/${id}`)).status).toBe(204);
    expect((await owner.get(`${API}/${id}`)).status).toBe(404);
    expect((await owner.download(`${API}/${id}/content`)).status).toBe(404);
    expect((await owner.del(`${API}/${id}`)).status).toBe(404);
  });
});
