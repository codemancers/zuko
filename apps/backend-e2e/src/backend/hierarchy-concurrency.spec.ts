import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, type Reply } from '../support/crm-client';

const run = Date.now().toString(36);
const suffix = `-${run}@hierarchy-race.test`;
const slugs = [`hierarchy-race-${run}`];
const owner = new User('Owner', `owner${suffix}`);
const previous = new User('Previous manager', `previous${suffix}`);
const next = new User('Next manager', `next${suffix}`);
const workers = Array.from({ length: 4 }, (_, i) => new User(`Worker ${i}`, `worker${i}${suffix}`));
const records = new Map<string, string>();
const API = '/api/v1';
const rec = (id: string) => `${API}/objects/contact/records/${id}`;
const set = (user: User, manager: User) =>
  owner.post('/auth/hierarchy/set-manager', { userId: user.id, managerId: manager.id });
function ok(reply: Reply, status = 200) {
  if (reply.status !== status) throw new Error(`Expected ${status}: ${JSON.stringify(reply)}`);
  return reply.data;
}

beforeAll(async () => {
  const users = [owner, previous, next, ...workers];
  for (const user of users) ok(await user.signUp());
  await verifyEmails(suffix);
  const org = ok(
    await owner.post('/auth/organization/create', { name: 'Hierarchy race', slug: slugs[0] }),
  ).id;
  for (const user of users.slice(1)) {
    const invitation = ok(
      await owner.post('/auth/organization/invite-member', {
        email: user.email,
        role: 'member',
        organizationId: org,
      }),
    );
    ok(await user.post('/auth/organization/accept-invitation', { invitationId: invitation.id }));
    ok(await user.signIn());
  }
  ok(await owner.post(`${API}/setup/standard-objects`));
  for (const worker of workers) {
    records.set(
      worker.id,
      ok(
        await owner.post(`${API}/objects/contact/records`, {
          properties: { first_name: worker.name },
          owner_id: worker.id,
        }),
        201,
      ).id,
    );
  }
}, 120_000);

afterAll(() => cleanup(suffix, slugs), 60_000);

describe('concurrent reporting changes', () => {
  it('revokes every old reporting relationship when several people move at once', async () => {
    for (let round = 0; round < 4; round++) {
      const oldManager = round % 2 === 0 ? previous : next;
      const newManager = round % 2 === 0 ? next : previous;
      for (const worker of workers) ok(await set(worker, oldManager));
      const changed = await Promise.all(workers.map((worker) => set(worker, newManager)));
      expect(changed.map((reply) => reply.status)).toEqual(workers.map(() => 200));
      for (const worker of workers) {
        expect((await oldManager.get(rec(records.get(worker.id)!))).status).toBe(404);
        expect((await newManager.get(rec(records.get(worker.id)!))).status).toBe(200);
      }
    }
  });

  it('checks cycles against the latest committed hierarchy', async () => {
    const replies = await Promise.all([set(workers[0], workers[1]), set(workers[1], workers[0])]);
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 400]);
    expect(replies.find((reply) => reply.status === 400)?.data.code).toBe('HIERARCHY_CYCLE');
  });
});
