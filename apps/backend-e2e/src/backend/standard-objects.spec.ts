import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, type Reply } from '../support/crm-client';

/**
 * The standard objects (contact, company, deal): who can set them up, that setting up twice
 * changes nothing, and that they behave like any object once they exist.
 *   Acme: owner, alice (member)      Other org: eve
 */
const run = Date.now().toString(36);
const suffix = `-${run}@std.test`;
const slugs = [`std-acme-${run}`, `std-eve-${run}`, `std-zed-${run}`];
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');
const eve = mk('eve');
const zed = mk('zed');
const API = '/api/v1';

function ok(reply: Reply, status = 200) {
  if (reply.status !== status) {
    throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  }
  return reply.data;
}
const names = (data: { results: { name: string }[] }) => data.results.map((o) => o.name);

beforeAll(async () => {
  for (const user of [owner, alice, eve, zed]) {
    ok(await user.signUp());
  }
  await verifyEmails(suffix);
  const acme = ok(
    await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] }),
  ).id;
  ok(await eve.post('/auth/organization/create', { name: 'Eve Co', slug: slugs[1] }));
  ok(await zed.post('/auth/organization/create', { name: 'Zed Co', slug: slugs[2] }));
  const invite = ok(
    await owner.post('/auth/organization/invite-member', {
      email: alice.email,
      role: 'member',
      organizationId: acme,
    }),
  );
  ok(await alice.post('/auth/organization/accept-invitation', { invitationId: invite.id }));
  ok(await alice.signIn());
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60_000);

describe('setting up', () => {
  it('provisions contact, company and deal before the organization is ready', async () => {
    const result = ok(await owner.get(`${API}/objects`));
    expect(names(result)).toEqual(['contact', 'company', 'deal']);
    expect(result.results.map((o: { object_kind: string }) => o.object_kind)).toEqual([
      'STANDARD',
      'STANDARD',
      'STANDARD',
    ]);
    expect(result.results.map((o: { plural_label: string }) => o.plural_label)).toEqual([
      'Contacts',
      'Companies',
      'Deals',
    ]);
    expect(names(ok(await alice.get(`${API}/objects`)))).toEqual(['contact', 'company', 'deal']);
  });

  it('says which kinds of record each can be linked to', async () => {
    const linkable = async (name: string) =>
      (
        ok(await owner.get(`${API}/objects/${name}`)).associations as {
          name: string;
          label: string;
          side: string;
        }[]
      ).map((a) => [a.name, a.label, a.side]);
    expect(await linkable('contact')).toEqual([
      ['contact_company', 'Companies', 'forward'],
      ['contact_deal', 'Deals', 'forward'],
    ]);
    expect(await linkable('company')).toEqual([
      ['contact_company', 'Contacts', 'reverse'],
      ['deal_company', 'Deals', 'reverse'],
    ]);
    expect(await linkable('deal')).toEqual([
      ['contact_deal', 'Contacts', 'reverse'],
      ['deal_company', 'Companies', 'forward'],
    ]);
  });

  it('gives each object its fields, flags and enum options', async () => {
    const contact = ok(await owner.get(`${API}/objects/contact`));
    const byName = Object.fromEntries(contact.fields.map((f: { name: string }) => [f.name, f]));
    expect(Object.keys(byName)).toEqual([
      'first_name',
      'last_name',
      'email',
      'phone',
      'job_title',
      'lifecycle_stage',
      'companies',
      'deals',
    ]);
    expect(byName.companies).toMatchObject({
      type: 'LINK',
      config: { link: 'contact_company', target: 'company', many: true },
    });
    expect(byName.first_name).toMatchObject({
      type: 'TEXT',
      required: true,
      filterable: true,
      max_length: 100,
    });
    expect(byName.email).toMatchObject({ type: 'EMAIL', unique: true, filterable: true });
    expect(byName.lifecycle_stage.config.options).toEqual([
      'subscriber',
      'lead',
      'qualified',
      'customer',
      'churned',
    ]);

    const deal = ok(await owner.get(`${API}/objects/deal`));
    expect(deal.fields.map((f: { name: string }) => f.name)).toEqual([
      'name',
      'amount',
      'stage',
      'expected_close_date',
      'companies',
    ]);
    expect(deal.fields.find((f: { name: string }) => f.name === 'expected_close_date').type).toBe(
      'TIMESTAMP',
    );
    expect(
      ok(await owner.get(`${API}/objects/company`)).fields.find(
        (f: { name: string }) => f.name === 'domain',
      ).unique,
    ).toBe(true);
  });

  it('does not expose the old lazy provisioning endpoint', async () => {
    expect((await owner.post(`${API}/setup/standard-objects`)).status).toBe(404);
  });

  it('provisions independent schemas for other organizations', async () => {
    for (const user of [eve, zed]) {
      expect(names(ok(await user.get(`${API}/objects`)))).toEqual(['contact', 'company', 'deal']);
      expect(ok(await user.get(`${API}/objects/company`)).object_kind).toBe('STANDARD');
    }
  });
});

describe('using them', () => {
  const people = `${API}/objects/contact/records`;
  const deals = `${API}/objects/deal/records`;

  it('creates and validates contacts', async () => {
    const ada = ok(
      await owner.post(people, {
        properties: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          email: 'Ada@Example.com',
          lifecycle_stage: 'lead',
        },
      }),
      201,
    );
    expect(ada.properties).toMatchObject({ first_name: 'Ada', email: 'Ada@Example.com' });

    const noName = await owner.post(people, { properties: { last_name: 'Nameless' } });
    expect(
      noName.data.errors.map((e: { field: string; code: string }) => `${e.field}:${e.code}`),
    ).toEqual(['first_name:REQUIRED_FIELD_MISSING']);
    const duplicate = await owner.post(people, {
      properties: { first_name: 'Other', email: 'ada@example.com' },
    });
    expect(duplicate.data.errors[0]).toMatchObject({ field: 'email', code: 'DUPLICATE_VALUE' });
    const badStage = await owner.post(people, {
      properties: { first_name: 'Bad', lifecycle_stage: 'vip' },
    });
    expect(badStage.data.errors[0]).toMatchObject({
      field: 'lifecycle_stage',
      code: 'INVALID_FIELD',
    });
  });

  it('creates deals, and sorts and filters them by amount and stage', async () => {
    for (const [name, amount, stage] of [
      ['Small', 1000, 'new'],
      ['Big', 90000, 'negotiation'],
      ['Won', 5000, 'won'],
    ] as const) {
      ok(
        await owner.post(deals, {
          properties: { name, amount, stage, expected_close_date: '2026-12-31' },
        }),
        201,
      );
    }
    const sorted = ok(await owner.get(`${deals}?sort=amount,desc`));
    expect(sorted.results.map((r: { properties: { name: string } }) => r.properties.name)).toEqual([
      'Big',
      'Won',
      'Small',
    ]);

    const open = ok(
      await owner.post(`${deals}/filter`, {
        filter_groups: [
          { filters: [{ field_path: 'stage', operator: 'NOT_IN', values: ['won', 'lost'] }] },
        ],
        sort: { field: 'amount', direction: 'ASC' },
      }),
    );
    expect(open.results.map((r: { properties: { name: string } }) => r.properties.name)).toEqual([
      'Small',
      'Big',
    ]);
    expect(sorted.results[0].properties.expected_close_date).toBe('2026-12-31T00:00:00.000Z');
  });

  it('keeps members to their own records, as with any object', async () => {
    const mine = ok(await alice.post(people, { properties: { first_name: 'Alice contact' } }), 201);
    expect(mine.owner_id).toBe(alice.id);
    const seen = ok(await alice.get(people)).results.map(
      (r: { properties: { first_name: string } }) => r.properties.first_name,
    );
    expect(seen).toEqual(['Alice contact']);
  });
});
