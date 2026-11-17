import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, withDb, type Reply } from '../support/crm-client';

/**
 * Changing and removing fields: who may, what may change (the key and type may not), and
 * that a removed field disappears from the API while its values stay stored.
 *   Acme: owner, alice (member)      Other org: eve
 */
const run = Date.now().toString(36);
const suffix = `-${run}@fld.test`;
const slugs = [`fld-acme-${run}`, `fld-eve-${run}`];
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');
const eve = mk('eve');
const API = '/api/v1';
const FIELDS = `${API}/objects/contact/fields`;
const RECORDS = `${API}/objects/contact/records`;

function ok(reply: Reply, status = 200) {
  if (reply.status !== status) {
    throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  }
  return reply.data;
}
const fieldNames = async (user: User) => (ok(await user.get(`${API}/objects/contact`)).fields as { name: string }[]).map((f) => f.name);

beforeAll(async () => {
  for (const user of [owner, alice, eve]) ok(await user.signUp());
  await verifyEmails(suffix);
  const acme = ok(await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] })).id;
  ok(await eve.post('/auth/organization/create', { name: 'Eve Co', slug: slugs[1] }));
  const invite = ok(await owner.post('/auth/organization/invite-member', { email: alice.email, role: 'member', organizationId: acme }));
  ok(await alice.post('/auth/organization/accept-invitation', { invitationId: invite.id }));
  ok(await alice.signIn());
  ok(await owner.post(`${API}/setup/standard-objects`));
  ok(await eve.post(`${API}/setup/standard-objects`));
  ok(await owner.post(FIELDS, { name: 'source', label: 'Source', type: 'ENUM', config: { options: ['web', 'referral'] } }), 201);
  ok(await owner.post(FIELDS, { name: 'notes', label: 'Notes', type: 'TEXT' }), 201);
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60_000);

describe('changing a field', () => {
  it('is for people who can manage the schema', async () => {
    expect((await alice.patch(`${FIELDS}/notes`, { label: 'Nope' })).status).toBe(403);
    expect((await alice.del(`${FIELDS}/notes`)).status).toBe(403);
    expect(ok(await owner.get(`${API}/objects/contact`)).fields.find((f: { name: string }) => f.name === 'notes').label).toBe('Notes');
  });

  it('changes the label and whether it is searchable, and bumps the version', async () => {
    const before = ok(await owner.get(`${API}/objects/contact`)).version;
    const field = ok(await owner.patch(`${FIELDS}/notes`, { label: 'Internal notes', filterable: true }));
    expect(field).toMatchObject({ name: 'notes', label: 'Internal notes', filterable: true, type: 'TEXT' });
    expect(ok(await owner.get(`${API}/objects/contact`)).version).toBe(before + 1);
  });

  it('never changes the key or the type', async () => {
    for (const body of [{ name: 'other' }, { type: 'NUMBER' }, { unique: true }]) {
      const reply = await owner.patch(`${FIELDS}/notes`, body);
      expect(reply.status).toBe(400);
      expect(reply.data.code).toBe('VALIDATION_FAILED');
    }
    expect(await fieldNames(owner)).toContain('notes');
  });

  it('says so for a field that does not exist, and keeps organizations apart', async () => {
    expect((await owner.patch(`${FIELDS}/nothing`, { label: 'x' })).status).toBe(404);
    expect((await eve.patch(`${FIELDS}/source`, { label: 'Hijacked' })).status).toBe(404); // eve has no such field
  });

  it('adds choices, and refuses to remove one that records use', async () => {
    ok(await owner.post(RECORDS, { properties: { first_name: 'Ada', source: 'web' } }), 201);
    const added = ok(await owner.patch(`${FIELDS}/source`, { config: { options: ['web', 'referral', 'event'] } }));
    expect(added.config.options).toEqual(['web', 'referral', 'event']);

    const refused = await owner.patch(`${FIELDS}/source`, { config: { options: ['referral', 'event'] } });
    expect(refused.status).toBe(409);
    expect(refused.data.message).toMatch(/web/);
    ok(await owner.patch(`${FIELDS}/source`, { config: { options: ['web', 'event'] } })); // referral is unused
  });

  it('only gives choices to a choice field', async () => {
    expect((await owner.patch(`${FIELDS}/notes`, { config: { options: ['a'] } })).status).toBe(400);
  });

  it('makes a field required only when every record has a value', async () => {
    const refused = await owner.patch(`${FIELDS}/notes`, { required: true });
    expect(refused.status).toBe(409); // Ada has no notes
    const records = ok(await owner.get(`${RECORDS}?page_size=100`)).results as { id: string }[];
    for (const r of records) ok(await owner.patch(`${RECORDS}/${r.id}`, { properties: { notes: 'hello' } }));
    expect(ok(await owner.patch(`${FIELDS}/notes`, { required: true })).required).toBe(true);
    ok(await owner.patch(`${FIELDS}/notes`, { required: false }));
  });
});

describe('removing a field', () => {
  it('takes it out of the object, the records and writes', async () => {
    const ada = (ok(await owner.get(`${RECORDS}?page_size=100`)).results as { id: string; properties: Record<string, unknown> }[])[0];
    expect(ada.properties.notes).toBe('hello');

    ok(await owner.del(`${FIELDS}/notes`));
    expect(await fieldNames(owner)).not.toContain('notes');
    expect(ok(await owner.get(`${RECORDS}/${ada.id}`)).properties).not.toHaveProperty('notes');
    expect(ok(await owner.get(`${RECORDS}?page_size=100`)).results[0].properties).not.toHaveProperty('notes');
    const write = await owner.patch(`${RECORDS}/${ada.id}`, { properties: { notes: 'again' } });
    expect(write.status).toBe(400);
    expect(write.data.errors[0].code).toBe('UNKNOWN_FIELD');
    expect((await owner.del(`${FIELDS}/notes`)).status).toBe(404);
    expect((await owner.patch(`${FIELDS}/notes`, { label: 'x' })).status).toBe(404);
  });

  it('brings the values back when a field with the same key and type is added again', async () => {
    const field = ok(await owner.post(FIELDS, { name: 'notes', label: 'Notes again', type: 'TEXT' }), 201);
    expect(field.label).toBe('Notes again');
    const ada = ok(await owner.get(`${RECORDS}?page_size=100`)).results[0];
    expect(ada.properties.notes).toBe('hello');
    expect((await owner.post(FIELDS, { name: 'notes', label: 'Dup', type: 'TEXT' })).status).toBe(409);
  });

  it('will not reuse the key for a different type', async () => {
    ok(await owner.del(`${FIELDS}/notes`));
    const reply = await owner.post(FIELDS, { name: 'notes', label: 'Notes', type: 'NUMBER' });
    expect(reply.status).toBe(409);
    expect(reply.data.message).toMatch(/removed/i);
  });
});

describe('what a link or user field may be set to', () => {
  it('never lets a link be required or searched, which would stop records being created', async () => {
    ok(await owner.post(FIELDS, { name: 'employer', label: 'Employer', type: 'LINK', config: { target: 'company', many: false } }), 201);

    for (const [body, field] of [[{ required: true }, 'required'], [{ filterable: true }, 'filterable']] as const) {
      const reply = await owner.patch(`${FIELDS}/employer`, body);
      expect(reply.status).toBe(400);
      expect(reply.data.errors[0]).toMatchObject({ field, code: 'INVALID_FIELD' });
    }
    expect(ok(await owner.get(`${API}/objects/contact`)).fields.find((f: { name: string }) => f.name === 'employer')).toMatchObject({ required: false, filterable: false });
    ok(await owner.post(RECORDS, { properties: { first_name: 'Still works' } }), 201); // creating is not blocked
    ok(await owner.patch(`${FIELDS}/employer`, { label: 'Company' })); // the label can still change
  });

  it('lets one member be searched but not several', async () => {
    ok(await owner.post(FIELDS, { name: 'owner_user', label: 'Owner user', type: 'USER' }), 201);
    ok(await owner.post(FIELDS, { name: 'reviewers', label: 'Reviewers', type: 'USER', config: { many: true } }), 201);

    expect(ok(await owner.patch(`${FIELDS}/owner_user`, { filterable: true })).filterable).toBe(true);
    const refused = await owner.patch(`${FIELDS}/reviewers`, { filterable: true });
    expect(refused.status).toBe(400);
    expect(refused.data.errors[0]).toMatchObject({ field: 'filterable', code: 'INVALID_FIELD' });

    // Turning one into several turns searching off, and it cannot be turned back on.
    expect(ok(await owner.patch(`${FIELDS}/owner_user`, { config: { many: true } })).filterable).toBe(false);
    expect((await owner.patch(`${FIELDS}/owner_user`, { filterable: true })).status).toBe(400);
    expect(ok(await owner.patch(`${FIELDS}/owner_user`, { config: { many: false }, filterable: true })).filterable).toBe(true); // both at once, back to one
  });
});

describe('history of a record whose sensitive field was removed', () => {
  it('still keeps the field\'s value out of the history when the record is deleted', async () => {
    ok(await owner.post(FIELDS, { name: 'secret_note', label: 'Secret note', type: 'TEXT', sensitive: true }), 201);
    const id = ok(await owner.post(RECORDS, { properties: { first_name: 'Sensitive', secret_note: 'the plaintext' } }), 201).id as string;

    ok(await owner.del(`${FIELDS}/secret_note`)); // the value stays stored; the field is no longer on the object
    ok(await owner.del(`${RECORDS}/${id}`));

    // The API cannot read a deleted record's history, so look at the rows themselves.
    const rows = await withDb((db) => db.query('SELECT action, changes FROM record_change WHERE "recordId" = $1 ORDER BY id', [id]));
    const history = rows.rows as { action: string; changes: Record<string, { old: unknown; new: unknown }> }[];
    expect(history.map((h) => h.action)).toEqual(['CREATE', 'DELETE']);
    for (const entry of history) {
      expect(JSON.stringify(entry.changes)).not.toContain('the plaintext');
      expect(entry.changes['secret_note']).toEqual({ old: '[redacted]', new: '[redacted]' });
    }
  });
});
