import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import axios from 'axios';
import { Client } from 'pg';
import type { ToolContext } from 'eve/tools';
import create from '../agent/tools/create_record';
import update from '../agent/tools/update_record';
import remove from '../agent/tools/delete_record';
import get from '../agent/tools/get_record';
import history from '../agent/tools/get_record_history';
import list from '../agent/tools/list_records';
import filter from '../agent/tools/filter_records';
import link from '../agent/tools/link_record';
import unlink from '../agent/tools/unlink_record';
import linked from '../agent/tools/list_linked_records';

const BASE = process.env.BACKEND_URL || 'http://localhost:3000';
const run = `${Date.now().toString(36)}-${process.pid}`;
const email = `owner-${run}@harness-tools.test`;
let userId = '';
let organizationId = '';
let cookie = '';
let ctx: ToolContext;

async function withDb<T>(work: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await db.connect();
  try {
    return await work(db);
  } finally {
    await db.end();
  }
}

async function post(path: string, data?: unknown) {
  const response = await axios.post(`${BASE}${path}`, data, {
    headers: { Origin: process.env.FRONTEND_URL || 'http://localhost:4200', Cookie: cookie },
    validateStatus: () => true,
  });
  if (response.headers['set-cookie'])
    cookie = response.headers['set-cookie'].map((value: string) => value.split(';')[0]).join('; ');
  if (response.status !== 200) throw new Error(JSON.stringify(response.data));
  return response.data;
}

describe.skipIf(!process.env.TEST_DATABASE_URL)('CRM tool integration', () => {
  beforeAll(async () => {
    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL)
      throw new Error(
        'DATABASE_URL and TEST_DATABASE_URL must identify the running backend dedicated test database',
      );
    userId = (
      await post('/auth/sign-up/email', {
        name: 'Harness tool owner',
        email,
        password: 'Harness-executor-test-2026!',
      })
    ).user.id;
    await withDb((db) => db.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', [userId]));
    organizationId = (
      await post('/auth/organization/create', {
        name: 'Harness tool checks',
        slug: `harness-tools-${run}`,
      })
    ).id;
    const deadline = Date.now() + 30_000;
    for (;;) {
      const ready = await withDb(
        async (db) =>
          (
            await db.query('SELECT status FROM organization_setup WHERE "organizationId"=$1', [
              organizationId,
            ])
          ).rows[0]?.status === 'ready',
      );
      if (ready) break;
      if (Date.now() > deadline) throw new Error('Organization provisioning did not finish');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    const route = await post('/api/v1/eve/token');
    const claims = JSON.parse(
      Buffer.from(route.access_token.split('.')[1], 'base64url').toString(),
    );
    ctx = {
      session: {
        auth: {
          current: {
            principalType: 'user',
            attributes: {
              'urn:zuko:harness_grant': claims['urn:zuko:harness_grant'],
              'urn:zuko:org_id': claims['urn:zuko:org_id'],
            },
          },
        },
      },
      abortSignal: new AbortController().signal,
    } as unknown as ToolContext;
  }, 60_000);

  afterAll(
    async () =>
      withDb(async (db) => {
        await db.query('BEGIN');
        await db.query("SELECT set_config('app.audit_purge','on',true)");
        await db.query('DELETE FROM audit_event WHERE "organizationId"=$1 OR "actorId"=$2', [
          organizationId || '0',
          userId || '0',
        ]);
        await db.query('DELETE FROM record_change WHERE "organizationId"=$1', [
          organizationId || '0',
        ]);
        await db.query('DELETE FROM object_record WHERE "organizationId"=$1', [
          organizationId || '0',
        ]);
        await db.query('DELETE FROM organization WHERE id=$1', [organizationId || '0']);
        await db.query('DELETE FROM "user" WHERE email=$1', [email]);
        await db.query('COMMIT');
      }),
    60_000,
  );

  // Exercise CRM executors independently of model output.
  it('maps CRM mutations, queries, links and audit history to the real REST services', async () => {
    const contact = await create.execute!(
      { object: 'contact', properties: { first_name: 'Ada', last_name: 'Lovelace' } },
      ctx,
    );
    const company = await create.execute!(
      { object: 'company', properties: { name: 'Analytical Engines' } },
      ctx,
    );
    expect(contact.owner_id).toBe(userId);
    const changed = await update.execute!(
      { object: 'contact', id: contact.id, properties: { first_name: 'Augusta Ada' } },
      ctx,
    );
    expect(changed.properties.first_name).toBe('Augusta Ada');
    expect(
      (await get.execute!({ object: 'contact', id: contact.id }, ctx)).properties.first_name,
    ).toBe('Augusta Ada');
    const connection = await link.execute!(
      { object: 'contact', id: contact.id, link: 'contact_company', record_id: company.id },
      ctx,
    );
    expect(connection.results).toEqual([{ id: company.id, label: 'Analytical Engines' }]);
    expect(
      (await linked.execute!({ object: 'company', id: company.id, link: 'contact_company' }, ctx))
        .results,
    ).toEqual([expect.objectContaining({ id: contact.id })]);
    const listed = await list.execute!(
      { object: 'contact', page_size: 5, sort: 'first_name,asc', include_links: true },
      ctx,
    );
    expect(listed.results[0].associations.contact_company).toEqual([
      { id: company.id, label: 'Analytical Engines' },
    ]);
    const found = await filter.execute!(
      {
        object: 'contact',
        include_links: true,
        filter_groups: [
          { filters: [{ field_path: 'first_name', operator: 'EQUALS', value: 'Augusta Ada' }] },
        ],
      },
      ctx,
    );
    expect(found.results.map((record: { id: string }) => record.id)).toEqual([contact.id]);
    expect((await history.execute!({ object: 'contact', id: contact.id }, ctx)).results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'CREATE', actor_type: 'MCP' }),
        expect.objectContaining({ action: 'UPDATE', actor_type: 'MCP' }),
      ]),
    );
    expect(
      (
        await unlink.execute!(
          { object: 'contact', id: contact.id, link: 'contact_company', record_id: company.id },
          ctx,
        )
      ).results,
    ).toEqual([]);
    expect((await remove.execute!({ object: 'contact', id: contact.id }, ctx)).deleted).toBe(true);
    expect((await get.execute!({ object: 'contact', id: contact.id }, ctx)).zuko_error.code).toBe(
      'NOT_FOUND',
    );
  });

  it('returns backend field validation errors without exposing an internal error', async () => {
    const invalid = await create.execute!(
      { object: 'deal', properties: { amount: 'lots', unknown: 1 } },
      ctx,
    );
    expect(invalid.zuko_error).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(invalid.zuko_error.errors.map((error: { field: string }) => error.field).sort()).toEqual(
      ['amount', 'name', 'unknown'],
    );
  });

  it('honors cancellation before a backend request can mutate a record', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      create.execute!(
        { object: 'contact', properties: { first_name: `Cancelled ${run}` } },
        { ...ctx, abortSignal: controller.signal },
      ),
    ).rejects.toThrow(/abort/i);
    const count = await withDb(
      async (db) =>
        (
          await db.query(
            'SELECT count(*)::int AS count FROM object_record WHERE "organizationId"=$1 AND properties->>\'first_name\'=$2',
            [ctx.session.auth.current!.attributes['urn:zuko:org_id'], `Cancelled ${run}`],
          )
        ).rows[0].count,
    );
    expect(count).toBe(0);
  });
});
