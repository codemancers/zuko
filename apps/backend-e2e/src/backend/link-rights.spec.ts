import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, type Reply } from '../support/crm-client';

/**
 * Who may change a link. A link is a field on one record (the holder: a deal's primary contact), so
 * it may be changed by whoever could change it from the holder: write access to the holder, read
 * access to the record it points at. From the other end the same holds, record by record.
 *   Acme: owner (sees everything), alice (member: her own records and what is shared with her)
 */
const run = Date.now().toString(36);
const suffix = `-${run}@lnkr.test`;
const slugs = [`lnkr-acme-${run}`];
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');
const API = '/api/v1';
const rec = (object: string, id: string) => `${API}/objects/${object}/records/${id}`;
const LINK = 'deal_primary_contact';
const link = (object: string, id: string, targetId?: string) =>
  `${rec(object, id)}/associations/${LINK}${targetId ? `/${targetId}` : ''}`;

function ok(reply: Reply, status = 200) {
  if (reply.status !== status) {
    throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  }
  return reply.data;
}
const create = async (user: User, object: string, properties: Record<string, unknown>) =>
  ok(await user.post(`${API}/objects/${object}/records`, { properties }), 201).id as string;
const linked = async (object: string, id: string) =>
  (ok(await owner.get(link(object, id))).results as { id: string }[]).map((r) => r.id);
const share = async (object: string, id: string, access: 'READ' | 'WRITE') =>
  ok(await owner.post(`${rec(object, id)}/shares`, { user_id: alice.id, access }), 201);

let aliceContact: string; // alice's own
let aliceDeal: string; // alice's own
let ownerContact: string; // the owner's, shared with alice to read
let ownerDeal: string; // the owner's, shared with alice to read, linked to ownerContact
let hiddenDeal: string; // the owner's, not shared

beforeAll(async () => {
  for (const user of [owner, alice]) ok(await user.signUp());
  await verifyEmails(suffix);
  const org = ok(
    await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] }),
  ).id;
  const invite = ok(
    await owner.post('/auth/organization/invite-member', {
      email: alice.email,
      role: 'member',
      organizationId: org,
    }),
  );
  ok(await alice.post('/auth/organization/accept-invitation', { invitationId: invite.id }));
  ok(await alice.signIn());
  ok(await owner.post(`${API}/setup/standard-objects`));
  ok(
    await owner.post(`${API}/objects/deal/fields`, {
      name: 'primary_contact',
      label: 'Primary contact',
      type: 'LINK',
      config: { target: 'contact', many: false },
    }),
    201,
  );

  aliceContact = await create(alice, 'contact', { first_name: 'Alice contact' });
  aliceDeal = await create(alice, 'deal', { name: 'Alice deal' });
  ownerContact = await create(owner, 'contact', { first_name: 'Owner contact' });
  ownerDeal = await create(owner, 'deal', { name: 'Owner deal' });
  hiddenDeal = await create(owner, 'deal', { name: 'Hidden deal' });
  await share('contact', ownerContact, 'READ');
  await share('deal', ownerDeal, 'READ');
  ok(await owner.post(link('deal', ownerDeal), { record_id: ownerContact }));
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60_000);

describe('changing a link from the end that points at it', () => {
  it('needs write access to the record that holds the link, not just to read it', async () => {
    const refused = await alice.post(link('contact', aliceContact), { record_id: ownerDeal }); // she can read the deal, not change it
    expect(refused.status).toBe(403);
    expect(await linked('deal', ownerDeal)).toEqual([ownerContact]); // nothing was taken from the deal's own primary contact
    expect(await linked('contact', aliceContact)).toEqual([]);
  });

  it('cannot reach a record the person cannot see', async () => {
    expect(
      (await alice.post(link('contact', aliceContact), { record_id: hiddenDeal })).status,
    ).toBe(404);
  });

  it('cannot unlink a record it may only read', async () => {
    ok(await owner.post(link('deal', ownerDeal), { record_id: aliceContact })); // the owner makes alice's contact the deal's primary
    expect(await linked('contact', aliceContact)).toEqual([ownerDeal]);

    const refused = await alice.del(link('contact', aliceContact, ownerDeal));
    expect(refused.status).toBe(403);
    expect(await linked('deal', ownerDeal)).toEqual([aliceContact]); // the owner's link is still there
    ok(await owner.post(link('deal', ownerDeal), { record_id: ownerContact })); // put it back
  });

  it('works for a record the person may change', async () => {
    expect(
      (
        ok(await alice.post(link('contact', aliceContact), { record_id: aliceDeal })).results as {
          id: string;
        }[]
      ).map((r) => r.id),
    ).toEqual([aliceDeal]);
    expect(await linked('deal', aliceDeal)).toEqual([aliceContact]);
  });

  it('needs only to read the record it is changed on, as from the holder it needs only to read the target', async () => {
    // Alice may not change the owner's contact, but she may link her own deal to it: the deal is what changes.
    expect((await alice.post(link('contact', ownerContact), { record_id: aliceDeal })).status).toBe(
      200,
    );
    expect(await linked('deal', aliceDeal)).toEqual([ownerContact]);
    expect(await linked('contact', aliceContact)).toEqual([]); // her deal moved off her first contact
    expect((await linked('contact', ownerContact)).sort()).toEqual([ownerDeal, aliceDeal].sort());
  });

  it('cannot replace a set that includes a record it may only read', async () => {
    // Setting the contact's deals to just hers would unlink the owner's deal, which is not hers to change.
    expect(
      (await alice.put(link('contact', ownerContact), { record_ids: [aliceDeal] })).status,
    ).toBe(403);
    expect(await linked('deal', ownerDeal)).toEqual([ownerContact]);
  });
});

describe('changing a link from the record that holds it', () => {
  it('needs write access to the holder and read access to the target', async () => {
    expect((await alice.post(link('deal', ownerDeal), { record_id: aliceContact })).status).toBe(
      403,
    ); // not hers to change
    expect(await alice.post(link('deal', aliceDeal), { record_id: aliceContact })).toMatchObject({
      status: 200,
    }); // hers
    expect(
      (
        await alice.post(link('deal', aliceDeal), {
          record_id: await create(owner, 'contact', { first_name: 'Unseen' }),
        })
      ).status,
    ).toBe(404); // not visible
  });

  it('refuses to replace a single link whose existing live target is hidden', async () => {
    const deal = await create(alice, 'deal', { name: 'Hidden primary contact' });
    const hidden = await create(owner, 'contact', { first_name: 'Private contact' });
    ok(await owner.post(link('deal', deal), { record_id: hidden }));

    expect((await alice.post(link('deal', deal), { record_id: aliceContact })).status).toBe(403);
    expect((await alice.put(link('deal', deal), { record_ids: [aliceContact] })).status).toBe(403);
    expect(await linked('deal', deal)).toEqual([hidden]);
    // An administrator can still replace it, and the original association is removed.
    ok(await owner.post(link('deal', deal), { record_id: aliceContact }));
    expect(await linked('deal', deal)).toEqual([aliceContact]);
  });

  it('can replace the association to a deleted target', async () => {
    const deal = await create(alice, 'deal', { name: 'Deleted primary contact' });
    const deleted = await create(owner, 'contact', { first_name: 'Former contact' });
    ok(await owner.post(link('deal', deal), { record_id: deleted }));
    ok(await owner.del(rec('contact', deleted)));
    ok(await alice.post(link('deal', deal), { record_id: aliceContact }));
    expect(await linked('deal', deal)).toEqual([aliceContact]);
  });

  it('serializes replacements from opposite ends of a single-value link', async () => {
    const deal = await create(owner, 'deal', { name: 'Concurrent links' });
    const a = await create(owner, 'contact', { first_name: 'A' });
    const b = await create(owner, 'contact', { first_name: 'B' });
    for (let round = 0; round < 6; round++) {
      const replies = await Promise.all([
        owner.post(link('deal', deal), { record_id: a }),
        owner.post(link('contact', b), { record_id: deal }),
      ]);
      expect(replies.map((reply) => reply.status)).toEqual([200, 200]);
      const targets = await linked('deal', deal);
      expect(targets).toHaveLength(1);
      expect([a, b]).toContain(targets[0]);
    }
  });
});
