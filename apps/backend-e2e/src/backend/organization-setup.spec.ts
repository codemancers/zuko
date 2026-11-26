import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, withDb } from '../support/crm-client';

const run = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const suffix = `-${run}@setup.test`;
const owner = new User('Setup owner', `owner${suffix}`, false);
const member = new User('Setup member', `member${suffix}`);
const outsider = new User('Outsider', `outside${suffix}`);
const slugs = [`setup-new-${run}`, `setup-recover-${run}`, `setup-conflict-${run}`];
const setupPath = (id: string) => `/api/v1/organizations/${id}/setup`;

beforeAll(async () => {
  for (const user of [owner, member, outsider]) {
    const reply = await user.signUp();
    if (reply.status !== 200) throw new Error(`Sign-up failed: ${JSON.stringify(reply)}`);
  }
  await verifyEmails(suffix);
}, 60000);
afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60000);

/** Simulate an org created before a setup hook could attach its workflow. */
async function unattachedOrganization(slug: string, collision = false) {
  return withDb(async (db) => {
    await db.query('BEGIN');
    try {
      const {
        rows: [org],
      } = await db.query('INSERT INTO organization (name, slug) VALUES ($1, $2) RETURNING id', [
        'Recovered org',
        slug,
      ]);
      await db.query(
        'INSERT INTO member ("organizationId", "userId", role) VALUES ($1,$2,\'owner\')',
        [org.id, owner.id],
      );
      if (collision) {
        await db.query(
          "INSERT INTO object_type (\"organizationId\",slug,label,\"pluralLabel\",kind,\"updatedAt\") VALUES ($1,'company','Custom company','Custom companies','CUSTOM',timezone('utc',now()))",
          [org.id],
        );
        await db.query(
          'INSERT INTO member ("organizationId", "userId", role) VALUES ($1,$2,\'member\')',
          [org.id, member.id],
        );
      }
      await db.query('COMMIT');
      return String(org.id);
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  });
}

describe('durable organization setup', () => {
  it('starts automatically after auth creates an organization', async () => {
    const created = await owner.post('/auth/organization/create', {
      name: 'Automatic setup',
      slug: slugs[0],
    });
    expect(created.status).toBe(200);
    const id = created.data.id;
    await owner.waitForSetup(id);
    const objects = await owner.get('/api/v1/objects');
    expect(objects.status).toBe(200);
    expect(objects.data.results.map((object: { name: string }) => object.name)).toEqual([
      'contact',
      'company',
      'deal',
      'prospect',
      'lead',
    ]);
    expect((await owner.post(`${setupPath(id)}/retry`)).status).toBe(404);
    expect(
      (await outsider.get(`/auth/organization/get-full-organization?organizationId=${id}`)).status,
    ).toBe(403);
    expect((await outsider.post(`${setupPath(id)}/retry`)).status).toBe(404);
    expect((await owner.get(setupPath(id))).status).toBe(404);
  });

  it('keeps SDK execution routes private for anonymous and signed-in callers', async () => {
    const anonymous = new User('Anonymous workflow caller', `anonymous${suffix}`);
    for (const caller of [anonymous, owner]) {
      for (const path of [
        '/api/.well-known/workflow/v1/flow',
        '/api/.well-known/workflow/v1/manifest.json',
      ]) {
        expect((await caller.get(path)).status).toBe(404);
        expect((await caller.post(path, { runId: 'forged-run' })).status).toBe(404);
      }
      expect((await caller.get('/.well-known/workflow/v1/flow')).status).toBe(404);
    }
  });

  it('recovers an existing organization with no workflow attached', async () => {
    const id = await unattachedOrganization(slugs[1]);
    await owner.waitForSetup(id);
    expect((await owner.post('/auth/organization/set-active', { organizationId: id })).status).toBe(
      200,
    );
    expect((await owner.get('/api/v1/objects')).data.results).toHaveLength(5);
  });

  it('rolls back failed provisioning and keeps recovery out of the application API', async () => {
    const id = await unattachedOrganization(slugs[2], true);
    expect((await owner.post('/auth/organization/set-active', { organizationId: id })).status).toBe(
      200,
    );
    const blocked = await owner.get('/api/v1/objects');
    expect(blocked.status).toBe(409);
    expect(blocked.data.code).toBe('ORGANIZATION_NOT_READY');
    const failed = await owner.waitForSetup(id, 'failed');
    expect(failed.error).toContain('The object key company is already used by a custom object');
    const denied = await member.post(`${setupPath(id)}/retry`);
    expect(denied.status).toBe(404);
    await withDb(async (db) => {
      const { rows } = await db.query(
        'SELECT slug,kind FROM object_type WHERE "organizationId"=$1',
        [id],
      );
      expect(rows).toEqual([{ slug: 'company', kind: 'CUSTOM' }]);
      await db.query('DELETE FROM object_type WHERE "organizationId"=$1 AND slug=\'company\'', [
        id,
      ]);
    });
  }, 60000);
});
