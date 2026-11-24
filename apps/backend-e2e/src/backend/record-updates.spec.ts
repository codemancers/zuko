import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, type Reply } from '../support/crm-client';

/** Updating one record from several requests at once must not lose any of the changes. */
const run = Date.now().toString(36);
const suffix = `-${run}@upd.test`;
const slugs = [`upd-acme-${run}`];
const owner = new User('owner', `owner${suffix}`);
const API = '/api/v1';
const rec = (id?: string) => `${API}/objects/contact/records${id ? `/${id}` : ''}`;

function ok(reply: Reply, status = 200) {
  if (reply.status !== status) {
    throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  }
  return reply.data;
}

beforeAll(async () => {
  ok(await owner.signUp());
  await verifyEmails(suffix);
  ok(await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] }));
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60_000);

describe('concurrent updates to one record', () => {
  it('keeps every change when different fields are updated at the same time', async () => {
    const fields: Record<string, string> = { last_name: 'Lovelace', phone: '555-0100', job_title: 'Engineer', lifecycle_stage: 'lead', email: '' };
    for (let round = 0; round < 8; round++) {
      const id = ok(await owner.post(rec(), { properties: { first_name: `Round ${round}` } }), 201).id as string;
      const changes = { ...fields, email: `round${round}@example.com` };

      const replies = await Promise.all(Object.entries(changes).map(([name, value]) => owner.patch(rec(id), { properties: { [name]: value } })));
      expect(replies.map((r) => r.status)).toEqual(Object.keys(changes).map(() => 200));

      const got = ok(await owner.get(rec(id))).properties;
      expect(got).toMatchObject({ first_name: `Round ${round}`, ...changes });
    }
  });

  it('records each change in the history exactly once, with the value it replaced', async () => {
    const id = ok(await owner.post(rec(), { properties: { first_name: 'History', phone: 'old' } }), 201).id as string;
    await Promise.all([
      owner.patch(rec(id), { properties: { phone: 'new' } }),
      owner.patch(rec(id), { properties: { job_title: 'Writer' } }),
      owner.patch(rec(id), { properties: { last_name: 'Author' } }),
    ]);
    const updates = (ok(await owner.get(`${rec(id)}/history`)).results as { action: string; changes: Record<string, { old: unknown; new: unknown }> }[]).filter((h) => h.action === 'UPDATE');
    const byField = Object.fromEntries(updates.flatMap((h) => Object.entries(h.changes)));
    expect(Object.keys(byField).sort()).toEqual(['job_title', 'last_name', 'phone']);
    expect(byField['phone']).toEqual({ old: 'old', new: 'new' });
    expect(byField['job_title']).toEqual({ old: null, new: 'Writer' });
  });
});
