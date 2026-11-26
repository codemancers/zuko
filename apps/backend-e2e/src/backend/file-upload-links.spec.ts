import axios from 'axios';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, withDb, type Reply } from '../support/crm-client';

/**
 * Signed, single-use upload links: how a client that cannot carry the user's token uploads a file.
 *   Acme: owner and alice (a member)        Other: carol, in another organization
 */
const run = Date.now().toString(36);
const suffix = `-${run}@uplinks.test`;
const slugs = [`ul-acme-${run}`, `ul-other-${run}`];
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');
const carol = mk('carol');
const API = '/api/v1';
const MB = 1024 * 1024;
const pdf = Buffer.from('%PDF-1.7 uploaded through a link');
let org: string;
let otherOrg: string;

const ok = (reply: Reply, status = 200) => {
  if (reply.status !== status) throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  return reply.data;
};
/** What curl does: no cookie, no Origin, just the link. */
const send = (url: string, filename: string, bytes: Uint8Array, field = 'file') => {
  const form = new FormData();
  form.append(field, new Blob([bytes]), filename);
  return axios.post(url, form, { validateStatus: () => true, maxBodyLength: Infinity, maxContentLength: Infinity });
};
const issue = async (user = owner) => ok(await user.post(`${API}/files/uploads`, {}), 201) as { upload_url: string; expires_at: string; expires_in_seconds: number; max_bytes: number; method: string; field: string; single_use: boolean };
const secretOf = (url: string) => url.split('/').at(-1)!.split('.')[2];
const fileCount = () => withDb(async (db) => (await db.query('SELECT count(*)::int AS n FROM stored_file WHERE "organizationId" = $1', [org])).rows[0].n as number);

beforeAll(async () => {
  for (const user of [owner, alice, carol]) ok(await user.signUp());
  await verifyEmails(suffix);
  org = ok(await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] })).id;
  const invite = ok(await owner.post('/auth/organization/invite-member', { email: alice.email, role: 'member', organizationId: org }));
  ok(await alice.post('/auth/organization/accept-invitation', { invitationId: invite.id }));
  ok(await alice.signIn());
  otherOrg = ok(await carol.post('/auth/organization/create', { name: 'Other', slug: slugs[1] })).id;
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60_000);

describe('asking for a link', () => {
  it('needs a signed-in user', async () => {
    expect((await new User('anon', `anon${suffix}`).post(`${API}/files/uploads`, {})).status).toBe(401);
  });

  it('returns a short-lived single-use link on the backend, with what to send', async () => {
    const link = await issue();
    expect(link).toMatchObject({ method: 'POST', field: 'file', single_use: true, expires_in_seconds: 300, max_bytes: 25 * MB });
    expect(link.upload_url).toMatch(new RegExp(`/api/v1/files/uploads/${org}\\.\\d+\\.[A-Za-z0-9_-]{43}$`));
    const lifetime = new Date(link.expires_at).getTime() - Date.now();
    expect(lifetime).toBeGreaterThan(280_000);
    expect(lifetime).toBeLessThanOrEqual(300_000);
  });

  it('records who asked, and stores only a hash of the secret', async () => {
    const link = await issue();
    const id = link.upload_url.split('/').at(-1)!.split('.')[1];
    const rows = await withDb(async (db) => (await db.query('SELECT "secretHash", "userId"::text AS u, "actorType" FROM upload_ticket WHERE id = $1', [id])).rows);
    expect(rows[0].u).toBe(owner.id);
    expect(rows[0].actorType).toBe('USER');
    expect(rows[0].secretHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].secretHash).not.toContain(secretOf(link.upload_url));
    const audit = await withDb(async (db) => (await db.query(`SELECT "actorType", "actorId"::text AS a FROM audit_event WHERE event = 'file.upload_link.issued' AND "targetId" = $1`, [id])).rows);
    expect(audit).toEqual([{ actorType: 'USER', a: owner.id }]);
  });
});

describe('uploading to a link', () => {
  it('stores the file for the user who asked, without any credentials of its own', async () => {
    const link = await issue();
    const reply = await send(link.upload_url, 'proposal.pdf', pdf);
    expect(reply.status).toBe(201);
    expect(reply.data).toMatchObject({ filename: 'proposal.pdf', media_type: 'application/pdf', size: pdf.length, uploaded_by: owner.id });
    const down = await owner.download(`${API}/files/${reply.data.id}/content`);
    expect(down.bytes.equals(pdf)).toBe(true);
    // it belongs to the user who asked, not to whoever held the link
    expect((await alice.get(`${API}/files/${reply.data.id}`)).status).toBe(404);
    const audit = await withDb(async (db) => (await db.query(`SELECT "actorType", "actorId"::text AS a FROM audit_event WHERE event = 'file.uploaded' AND "targetId" = $1`, [reply.data.id])).rows);
    expect(audit).toEqual([{ actorType: 'USER', a: owner.id }]);
  });

  it('works once: a second upload to the same link is refused and stores nothing', async () => {
    const link = await issue();
    expect((await send(link.upload_url, 'one.pdf', pdf)).status).toBe(201);
    const before = await fileCount();
    const again = await send(link.upload_url, 'two.pdf', pdf);
    expect(again.status).toBe(410);
    expect(again.data.code).toBe('UPLOAD_LINK_USED');
    expect(await fileCount()).toBe(before);
  });

  it('lets exactly one of two simultaneous uploads through', async () => {
    const link = await issue();
    const before = await fileCount();
    const [a, b] = await Promise.all([send(link.upload_url, 'a.pdf', pdf), send(link.upload_url, 'b.pdf', pdf)]);
    expect([a.status, b.status].sort()).toEqual([201, 410]);
    expect(await fileCount()).toBe(before + 1);
  });

  it('refuses an expired link', async () => {
    const link = await issue();
    const id = link.upload_url.split('/').at(-1)!.split('.')[1];
    await withDb((db) => db.query(`UPDATE upload_ticket SET "expiresAt" = now() - interval '1 minute' WHERE id = $1`, [id]));
    const reply = await send(link.upload_url, 'late.pdf', pdf);
    expect(reply.status).toBe(410);
    expect(reply.data.code).toBe('UPLOAD_LINK_EXPIRED');
  });

  it('refuses a wrong secret, a malformed link, and another organization\'s id, all alike', async () => {
    const link = await issue();
    const [orgPart, idPart, secret] = link.upload_url.split('/').at(-1)!.split('.');
    const base = link.upload_url.slice(0, link.upload_url.lastIndexOf('/') + 1);
    const flipped = secret.slice(0, -1) + (secret.endsWith('A') ? 'B' : 'A');
    for (const token of [`${orgPart}.${idPart}.${flipped}`, `${orgPart}.${idPart}.${'x'.repeat(43)}`, `${otherOrg}.${idPart}.${secret}`, `${orgPart}.999999999.${secret}`, 'garbage', `${orgPart}.${idPart}`, `${orgPart}.${idPart}.${secret}.extra`]) {
      const reply = await send(`${base}${encodeURIComponent(token)}`, 'x.pdf', pdf);
      expect(reply.status).toBe(401);
      expect(reply.data.code).toBe('INVALID_UPLOAD_LINK');
    }
    // none of that spent the real link
    expect((await send(link.upload_url, 'real.pdf', pdf)).status).toBe(201);
  });

  it('never echoes the secret in an error', async () => {
    const link = await issue();
    const secret = secretOf(link.upload_url);
    expect((await send(link.upload_url, 'x.pdf', pdf)).status).toBe(201);
    const spent = await send(link.upload_url, 'x.pdf', pdf);
    expect(JSON.stringify(spent.data)).not.toContain(secret);
    expect(spent.data.path).toContain('/files/uploads/[redacted]');
  });
});

describe('what the upload accepts', () => {
  it('applies the same rules as any upload: sniffed type, 25 MB cap, no empty files', async () => {
    const html = await send((await issue()).upload_url, 'page.html', Buffer.from('<script>alert(1)</script>'));
    expect(html.status).toBe(201);
    expect(html.data.media_type).toBe('application/octet-stream');
    const before = await fileCount();
    const big = await send((await issue()).upload_url, 'big.bin', Buffer.alloc(25 * MB + 1, 1));
    expect(big.status).toBe(413);
    expect((await send((await issue()).upload_url, 'empty.txt', Buffer.alloc(0))).status).toBe(400);
    expect((await send((await issue()).upload_url, 'wrong.pdf', pdf, 'document')).status).toBeGreaterThanOrEqual(400);
    expect(await fileCount()).toBe(before);
  }, 60_000);

  it('spends the link even when the upload fails, so a failed upload needs a new link', async () => {
    const link = await issue();
    expect((await send(link.upload_url, 'big.bin', Buffer.alloc(25 * MB + 1, 1))).status).toBe(413);
    expect((await send(link.upload_url, 'ok.pdf', pdf)).status).toBe(410);
  }, 60_000);
});

describe('who may upload', () => {
  const setRole = (user: User, role: string) =>
    withDb((db) => db.query('UPDATE member SET role = $1 WHERE "userId" = $2 AND "organizationId" = $3', [role, user.id, org]));
  afterAll(() => setRole(alice, 'member'));

  it('refuses a role that can neither change records nor comment, before reading any bytes', async () => {
    await setRole(alice, 'viewer'); // a role with no capabilities at all
    const before = await fileCount();
    const direct = await alice.upload(`${API}/files`, 'a.pdf', pdf, 'application/pdf');
    expect(direct.status).toBe(403);
    expect(direct.data.message).toMatch(/not allowed to upload/);
    expect((await alice.post(`${API}/files/uploads`, {})).status).toBe(403);
    expect(await fileCount()).toBe(before);
  });

  it('refuses a link used after its owner lost the right, and lets them back in when they regain it', async () => {
    await setRole(alice, 'member');
    const link = await issue(alice);
    await setRole(alice, 'viewer');
    const refused = await send(link.upload_url, 'late.pdf', pdf);
    expect(refused.status).toBe(403);
    await setRole(alice, 'member');
    expect((await alice.upload(`${API}/files`, 'back.pdf', pdf, 'application/pdf')).status).toBe(201);
    expect((await send((await issue(alice)).upload_url, 'back2.pdf', pdf)).status).toBe(201);
  });

  it('still lets a viewer read the files they can see', async () => {
    await setRole(alice, 'member');
    const file = ok(await alice.upload(`${API}/files`, 'mine.pdf', pdf, 'application/pdf'), 201);
    await setRole(alice, 'viewer');
    expect((await alice.get(`${API}/files/${file.id}`)).status).toBe(200);
    await setRole(alice, 'member');
  });
});
