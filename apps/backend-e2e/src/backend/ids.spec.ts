import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, type Reply } from '../support/crm-client';

/** Ids are bigints. One too big for the column is a bad request, not a server error. */
const run = Date.now().toString(36);
const suffix = `-${run}@ids.test`;
const slugs = [`ids-acme-${run}`];
const owner = new User('owner', `owner${suffix}`);
const API = '/api/v1';
const REC = `${API}/objects/contact/records`;
const TOO_BIG = '9223372036854775808'; // 2^63, one more than a bigint holds
const LARGEST = '9223372036854775807'; // 2^63 - 1, which fits (and does not exist)

function ok(reply: Reply, status = 200) {
  if (reply.status !== status) {
    throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  }
  return reply.data;
}

let contact: string;

beforeAll(async () => {
  ok(await owner.signUp());
  await verifyEmails(suffix);
  ok(await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] }));
  ok(await owner.post(`${API}/objects/contact/fields`, { name: 'manager', label: 'Manager', type: 'USER' }), 201);
  contact = ok(await owner.post(REC, { properties: { first_name: 'Ada' } }), 201).id;
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60_000);

describe('ids beyond the range of a bigint', () => {
  it('are not found when they are in the URL', async () => {
    expect((await owner.get(`${REC}/${TOO_BIG}`)).status).toBe(404);
    expect((await owner.get(`${REC}/${LARGEST}`)).status).toBe(404); // fits, and simply is not there
    expect((await owner.get(`${REC}/${contact}/associations/contact_company/${TOO_BIG}`)).status).toBe(404);
    expect((await owner.del(`${API}/connections/${TOO_BIG}`)).status).toBe(404);
  });

  it('are refused as values, with a reason', async () => {
    const refused = async (reply: Reply) => {
      expect(reply.status).toBe(400);
      expect(reply.data.code).toBe('VALIDATION_FAILED');
    };
    await refused(await owner.patch(`${REC}/${contact}`, { owner_id: TOO_BIG }));
    await refused(await owner.patch(`${REC}/${contact}`, { team_id: TOO_BIG }));
    await refused(await owner.patch(`${REC}/${contact}`, { properties: { manager: TOO_BIG } }));
    await refused(await owner.post(`${REC}/filter`, { filter_groups: [{ filters: [{ field_path: 'id', operator: 'EQUALS', value: TOO_BIG }] }] }));
    await refused(await owner.post(`${REC}/${contact}/shares`, { user_id: TOO_BIG, access: 'READ' }));
    // A link to a record that cannot exist is just not found.
    expect((await owner.post(`${REC}/${contact}/associations/contact_company`, { record_id: TOO_BIG })).status).toBe(404);
  });

  it('still accepts the largest id that fits', async () => {
    expect((await owner.post(`${REC}/filter`, { filter_groups: [{ filters: [{ field_path: 'id', operator: 'EQUALS', value: LARGEST }] }] })).status).toBe(200);
  });
});
