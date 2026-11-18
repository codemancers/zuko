import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { organization } from 'better-auth/plugins';
import { beforeAll, describe, expect, it } from 'vitest';
import { hierarchy } from '../index.js';

const PASSWORD = 'correct-horse-battery-1';

function createTestAuth() {
  const db = {
    user: [],
    session: [],
    account: [],
    verification: [],
    organization: [],
    member: [],
    invitation: [],
    memberReporting: [],
    memberHierarchy: [],
  };
  return betterAuth({
    baseURL: 'http://localhost:3000',
    secret: 'test-secret-test-secret-test-secret-1234',
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true },
    plugins: [organization(), hierarchy()],
  });
}

type TestAuth = ReturnType<typeof createTestAuth>;

describe('hierarchy endpoints', () => {
  let auth: TestAuth;
  let orgId: string;
  const ids: Record<string, string> = {};
  const headers: Record<string, Headers> = {};

  async function signUp(name: string) {
    const res = await auth.api.signUpEmail({
      body: { name, email: `${name}@example.com`, password: PASSWORD },
      returnHeaders: true,
    });
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0];
    headers[name] = new Headers({ cookie });
    ids[name] = res.response.user.id;
  }

  const setManager = (as: string, user: string, manager: string | null) =>
    auth.api.setManager({
      body: { userId: ids[user], managerId: manager === null ? null : ids[manager] },
      headers: headers[as],
    });
  const reports = async (as: string, of?: string, depth: 'direct' | 'all' = 'all') =>
    (
      await auth.api.listReports({
        query: { userId: of ? ids[of] : undefined, depth },
        headers: headers[as],
      })
    ).userIds
      .map((id) => Object.keys(ids).find((n) => ids[n] === id))
      .sort();

  beforeAll(async () => {
    auth = createTestAuth();
    // owner creates the org; ceo/vp/lead/ic are plain members, admin is an admin.
    for (const name of ['owner', 'admin', 'ceo', 'vp', 'lead', 'ic', 'outsider']) {
      await signUp(name);
    }
    const org = await auth.api.createOrganization({
      body: { name: 'Acme', slug: 'acme' },
      headers: headers['owner'],
    });
    orgId = org.id;
    for (const name of ['admin', 'ceo', 'vp', 'lead', 'ic']) {
      await auth.api.addMember({
        body: { userId: ids[name], role: name === 'admin' ? 'admin' : 'member', organizationId: orgId },
      });
      await auth.api.setActiveOrganization({ body: { organizationId: orgId }, headers: headers[name] });
    }
  });

  it('builds the closure from reporting lines', async () => {
    await setManager('owner', 'vp', 'ceo');
    await setManager('admin', 'lead', 'vp');
    await setManager('owner', 'ic', 'lead');

    expect(await reports('owner', 'ceo')).toEqual(['ic', 'lead', 'vp']);
    expect(await reports('owner', 'ceo', 'direct')).toEqual(['vp']);
    expect(await reports('owner', 'vp')).toEqual(['ic', 'lead']);
  });

  it('lets people see their own reports', async () => {
    expect(await reports('ceo')).toEqual(['ic', 'lead', 'vp']);
    expect(await reports('lead')).toEqual(['ic']);
    expect(await reports('ic')).toEqual([]);
  });

  it("stops members changing or viewing someone else's lines", async () => {
    await expect(setManager('ic', 'ic', 'ceo')).rejects.toMatchObject({ status: 'FORBIDDEN' });
    await expect(reports('ic', 'ceo')).rejects.toMatchObject({ status: 'FORBIDDEN' });
  });

  it('rejects loops', async () => {
    await expect(setManager('owner', 'ceo', 'ic')).rejects.toMatchObject({
      status: 'BAD_REQUEST',
      body: { code: 'HIERARCHY_CYCLE' },
    });
    await expect(setManager('owner', 'ic', 'ic')).rejects.toMatchObject({ body: { code: 'HIERARCHY_CYCLE' } });
  });

  it('rejects people outside the organization', async () => {
    await expect(setManager('owner', 'ic', 'outsider')).rejects.toMatchObject({ body: { code: 'NOT_A_MEMBER' } });
  });

  it('updates the closure when someone moves', async () => {
    await setManager('owner', 'lead', 'ceo'); // lead (and ic under them) now report straight to ceo
    expect(await reports('owner', 'vp')).toEqual([]);
    expect(await reports('owner', 'ceo', 'direct')).toEqual(['lead', 'vp']);
    expect(await reports('owner', 'ceo')).toEqual(['ic', 'lead', 'vp']);
  });

  it('clears a manager', async () => {
    await setManager('owner', 'vp', null);
    expect(await reports('owner', 'ceo')).toEqual(['ic', 'lead']);
  });

  it('keeps reports visible to the next manager when a manager leaves', async () => {
    await auth.api.removeMember({
      body: { memberIdOrEmail: 'lead@example.com', organizationId: orgId },
      headers: headers['owner'],
    });
    expect(await reports('owner', 'ceo')).not.toContain('lead');
    // The next rebuild moves ic up to ceo.
    await setManager('owner', 'vp', 'ceo');
    expect(await reports('owner', 'ceo')).toEqual(['ic', 'vp']);
  });
});
