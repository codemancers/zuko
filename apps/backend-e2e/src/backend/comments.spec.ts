import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, type Reply } from '../support/crm-client';

/**
 * Comments on records, and the timeline that interleaves them with the record's changes.
 *   Acme: owner (sees everything), alice (member), bob (member; sees only what is shared with him)
 *   Other: carol, in another organization
 */
const run = Date.now().toString(36);
const suffix = `-${run}@cmts.test`;
const slugs = [`cmts-acme-${run}`, `cmts-other-${run}`];
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');
const bob = mk('bob');
const carol = mk('carol');
const API = '/api/v1';
const rec = (id: string) => `${API}/objects/contact/records/${id}`;

function ok(reply: Reply, status = 200) {
  if (reply.status !== status) {
    throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  }
  return reply.data;
}
type Item = {
  type: 'change' | 'comment';
  id: string;
  body?: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_type: string;
  edited_at?: string | null;
  mentions?: string[];
  changes?: Record<string, unknown>;
};
/** Changes and comments are numbered separately, so an item is identified by both. */
const has = (items: Item[], made: Item) =>
  items.some((i) => i.type === 'comment' && i.id === made.id);
const activity = async (user: User, id: string, query = '') =>
  ok(await user.get(`${rec(id)}/activity${query}`)) as {
    results: Item[];
    next_before: string | null;
  };
const comment = async (user: User, id: string, body: string, mentions: string[] = []) =>
  ok(await user.post(`${rec(id)}/comments`, { body, mentions }), 201) as Item;

let ownerContact: string; // the owner's, not shared
let sharedContact: string; // the owner's, shared with alice to read

beforeAll(async () => {
  for (const user of [owner, alice, bob, carol]) ok(await user.signUp());
  await verifyEmails(suffix);
  const org = ok(
    await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] }),
  ).id;
  for (const user of [alice, bob]) {
    const invite = ok(
      await owner.post('/auth/organization/invite-member', {
        email: user.email,
        role: 'member',
        organizationId: org,
      }),
    );
    ok(await user.post('/auth/organization/accept-invitation', { invitationId: invite.id }));
    ok(await user.signIn());
  }
  ok(await carol.post('/auth/organization/create', { name: 'Other', slug: slugs[1] }));

  ownerContact = ok(
    await owner.post(`${API}/objects/contact/records`, { properties: { first_name: 'Hidden' } }),
    201,
  ).id;
  sharedContact = ok(
    await owner.post(`${API}/objects/contact/records`, { properties: { first_name: 'Shared' } }),
    201,
  ).id;
  ok(await owner.post(`${rec(sharedContact)}/shares`, { user_id: alice.id, access: 'READ' }), 201);
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60_000);

describe('the timeline', () => {
  it('interleaves changes and comments in the order they happened, oldest first', async () => {
    ok(await owner.patch(rec(sharedContact), { properties: { first_name: 'Shared one' } }));
    await comment(owner, sharedContact, 'First thoughts');
    ok(await owner.patch(rec(sharedContact), { properties: { first_name: 'Shared two' } }));
    await comment(owner, sharedContact, 'Second thoughts');

    const { results, next_before } = await activity(owner, sharedContact);
    expect(next_before).toBeNull();
    expect(results.map((i) => (i.type === 'comment' ? i.body : 'change'))).toEqual([
      'change', // CREATE
      'change', // the share with alice
      'change',
      'First thoughts',
      'change',
      'Second thoughts',
    ]);
    const first = results[3];
    expect(first).toMatchObject({
      actor_id: owner.id,
      actor_name: owner.name,
      actor_type: 'USER',
      edited_at: null,
    });
  });

  it('lists comments alone', async () => {
    const { results } = ok(await owner.get(`${rec(sharedContact)}/comments`)) as {
      results: Item[];
    };
    expect(results.map((i) => i.body)).toEqual(['First thoughts', 'Second thoughts']);
  });

  it('pages back from the newest item with a cursor', async () => {
    const page = await activity(owner, sharedContact, '?limit=2');
    expect(page.results.map((i) => i.body)).toEqual([undefined, 'Second thoughts']);
    expect(page.next_before).toEqual(expect.any(String));

    const older = await activity(owner, sharedContact, `?limit=2&before=${page.next_before}`);
    expect(older.results.map((i) => i.body)).toEqual([undefined, 'First thoughts']);
    const oldest = await activity(owner, sharedContact, `?limit=2&before=${older.next_before}`);
    expect(oldest.results).toHaveLength(2);
    expect(oldest.next_before).toBeNull();
    // No item is repeated or skipped.
    const all = [...oldest.results, ...older.results, ...page.results].map(
      (i) => `${i.type}${i.id}`,
    );
    expect(new Set(all).size).toBe(6);
  });

  it('refuses a cursor it did not issue', async () => {
    expect((await owner.get(`${rec(sharedContact)}/activity?before=nonsense`)).status).toBe(400);
    expect((await owner.get(`${rec(sharedContact)}/activity?limit=0`)).status).toBe(400);
  });
});

describe('who may comment', () => {
  it('does not show a record the person cannot see', async () => {
    expect((await alice.get(`${rec(ownerContact)}/comments`)).status).toBe(404);
    expect((await alice.get(`${rec(ownerContact)}/activity`)).status).toBe(404);
    expect((await alice.post(`${rec(ownerContact)}/comments`, { body: 'hi' })).status).toBe(404);
  });

  it('lets someone who can only read a record comment on it', async () => {
    expect(
      (await alice.patch(rec(sharedContact), { properties: { first_name: 'Nope' } })).status,
    ).toBe(403);
    const made = await comment(alice, sharedContact, 'Looks right to me');
    expect(made).toMatchObject({ actor_id: alice.id, actor_name: alice.name });
    expect(has((await activity(owner, sharedContact)).results, made)).toBe(true);
  });

  it('does not cross organizations', async () => {
    expect((await carol.get(`${rec(sharedContact)}/comments`)).status).toBe(404);
    expect((await carol.post(`${rec(sharedContact)}/comments`, { body: 'hi' })).status).toBe(404);
  });
});

describe('what a comment may say', () => {
  it('needs some text, and not too much', async () => {
    expect((await owner.post(`${rec(sharedContact)}/comments`, { body: '   ' })).status).toBe(400);
    expect((await owner.post(`${rec(sharedContact)}/comments`, {})).status).toBe(400);
    const tooLong = await owner.post(`${rec(sharedContact)}/comments`, {
      body: 'x'.repeat(10_001),
    });
    expect(tooLong.status).toBe(400);
    expect(JSON.stringify(tooLong.data)).toContain('10000');
  });

  it('mentions only members who can read the record', async () => {
    const refused = await owner.post(`${rec(sharedContact)}/comments`, {
      body: 'Look @bob',
      mentions: [bob.id],
    });
    expect(refused.status).toBe(400);
    expect(JSON.stringify(refused.data)).toContain('cannot see');

    const made = await comment(owner, sharedContact, 'Look @alice', [alice.id, alice.id]);
    expect(made.mentions).toEqual([alice.id]);

    const stranger = await owner.post(`${rec(sharedContact)}/comments`, {
      body: 'Look',
      mentions: [carol.id],
    });
    expect(stranger.status).toBe(400);
    expect(JSON.stringify(stranger.data)).toContain('members of this organization');
  });
});

describe('editing and deleting', () => {
  let mine: Item;
  beforeAll(async () => {
    mine = await comment(alice, sharedContact, 'Draft wording');
  });
  const one = () => `${rec(sharedContact)}/comments/${mine.id}`;

  it('lets only the author edit, and says it was edited', async () => {
    expect((await owner.patch(one(), { body: 'Hijacked' })).status).toBe(403);
    const edited = ok(await alice.patch(one(), { body: 'Final wording' })) as Item;
    expect(edited).toMatchObject({ body: 'Final wording', edited_at: expect.any(String) });
    expect((await alice.patch(one(), {})).status).toBe(400);
  });

  it('lets an admin remove anyone’s comment but not a member remove another’s', async () => {
    const theirs = await comment(owner, sharedContact, 'Owner note');
    expect((await alice.del(`${rec(sharedContact)}/comments/${theirs.id}`)).status).toBe(403);
    ok(await owner.del(one())); // the owner removes alice's comment
    expect(has((await activity(owner, sharedContact)).results, mine)).toBe(false);
    expect((await alice.del(one())).status).toBe(404); // already gone
    expect((await alice.patch(one(), { body: 'again' })).status).toBe(404);
  });
});
