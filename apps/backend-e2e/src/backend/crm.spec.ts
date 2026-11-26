import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, withDb, type Reply } from '../support/crm-client';

/**
 * One end-to-end run of the whole CRM backend against a running server and database:
 * organizations, invitations, teams, reporting lines, schema, records, scopes, role
 * overrides, shares, filtering, tenant isolation and audit. Everything it creates is
 * removed afterwards.
 *
 *   people (org "Acme"):  owner, admin, alice (manages bob), bob, carol & dave (team Sales)
 *   other org:            eve        no organization: loner
 */
const run = Date.now().toString(36);
const suffix = `-${run}@e2e.test`;
const slugs = [`e2e-acme-${run}`, `e2e-eve-${run}`];
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const admin = mk('admin');
const alice = mk('alice');
const bob = mk('bob');
const carol = mk('carol');
const dave = mk('dave');
const eve = mk('eve');
const loner = mk('loner');

const API = '/api/v1';
const REC = `${API}/objects/opportunity/records`;

let orgId = '';
let eveOrgId = '';
let salesId = '';
let aliceRecord = ''; // alice's opportunity
let bobRecord = ''; // bob's opportunity

/** Assert the status with the response body in the failure message. */
function expectStatus(reply: Reply, status: number) {
  if (reply.status !== status) {
    throw new Error(`Expected ${status} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  }
  return reply.data;
}
const errorCodes = (reply: Reply) =>
  (reply.data?.errors ?? []).map((e: { field: string; code: string }) => `${e.field}:${e.code}`);

async function createDeal(
  user: User,
  properties: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return user.post(REC, { properties, ...extra });
}

async function join(user: User, role: 'admin' | 'member') {
  const invite = await owner.post('/auth/organization/invite-member', {
    email: user.email,
    role,
    organizationId: orgId,
  });
  const invitationId = expectStatus(invite, 200).id;
  expectStatus(await user.post('/auth/organization/accept-invitation', { invitationId }), 200);
  expectStatus(await user.signIn(), 200); // a new session starts in the user's organization
}

beforeAll(async () => {
  for (const user of [owner, admin, alice, bob, carol, dave, eve, loner]) {
    expectStatus(await user.signUp(), 200);
  }
  await verifyEmails(suffix);

  orgId = expectStatus(
    await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] }),
    200,
  ).id;
  eveOrgId = expectStatus(
    await eve.post('/auth/organization/create', { name: 'Eve Co', slug: slugs[1] }),
    200,
  ).id;

  await join(admin, 'admin');
  for (const user of [alice, bob, carol, dave]) {
    await join(user, 'member');
  }

  salesId = expectStatus(
    await owner.post('/auth/organization/create-team', { name: 'Sales', organizationId: orgId }),
    200,
  ).id;
  for (const user of [carol, dave]) {
    expectStatus(
      await owner.post('/auth/organization/add-team-member', { teamId: salesId, userId: user.id }),
      200,
    );
  }
  expectStatus(
    await owner.post('/auth/hierarchy/set-manager', { userId: bob.id, managerId: alice.id }),
    200,
  );

  expectStatus(await owner.post(`${API}/objects`, { slug: 'opportunity', label: 'Deal' }), 201);
  const fields = [
    { name: 'name', label: 'Name', type: 'TEXT', required: true, filterable: true },
    { name: 'email', label: 'Email', type: 'EMAIL', unique: true },
    { name: 'amount', label: 'Amount', type: 'NUMBER', filterable: true },
    {
      name: 'stage',
      label: 'Stage',
      type: 'ENUM',
      filterable: true,
      config: { options: ['open', 'won', 'lost'] },
    },
    { name: 'secret', label: 'Secret', type: 'TEXT', sensitive: true },
  ];
  for (const field of fields) {
    expectStatus(await owner.post(`${API}/objects/opportunity/fields`, field), 201);
  }
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs);
}, 60_000);

describe('setup', () => {
  it('puts everyone in the right organization with the right role', async () => {
    const roles: Record<string, string> = {
      owner: 'owner',
      admin: 'admin',
      alice: 'member',
      bob: 'member',
      carol: 'member',
      dave: 'member',
    };
    for (const [name, role] of Object.entries(roles)) {
      const me = expectStatus(
        await { owner, admin, alice, bob, carol, dave }[name as 'owner'].get(`${API}/me`),
        200,
      );
      expect(me.organization_id).toBe(orgId);
      expect(me.roles).toEqual([role]);
      expect(me.can_manage_objects).toBe(role !== 'member'); // owners and admins manage the schema
    }
    expect(expectStatus(await carol.get(`${API}/me`), 200).team_ids).toEqual([salesId]);
    expect(expectStatus(await alice.get(`${API}/me`), 200).team_ids).toEqual([]);
  });
});

describe('schema', () => {
  it('lets members read but not change the schema', async () => {
    expect(
      expectStatus(await alice.get(`${API}/objects`), 200).results.map(
        (o: { name: string }) => o.name,
      ),
    ).toContain('opportunity');
    const denied = await alice.post(`${API}/objects`, { slug: 'secret_thing', label: 'Nope' });
    expect(denied.status).toBe(403);
    expect(denied.data.code).toBe('FORBIDDEN');
    expect(
      (
        await alice.post(`${API}/objects/opportunity/fields`, {
          name: 'x',
          label: 'X',
          type: 'TEXT',
        })
      ).status,
    ).toBe(403);
  });

  it('lets admins add fields, which bumps the version', async () => {
    const before = expectStatus(await owner.get(`${API}/objects/opportunity`), 200).version;
    expectStatus(
      await admin.post(`${API}/objects/opportunity/fields`, {
        name: 'region',
        label: 'Region',
        type: 'TEXT',
      }),
      201,
    );
    const after = expectStatus(await owner.get(`${API}/objects/opportunity`), 200);
    expect(after.version).toBe(before + 1);
    expect(after.fields.map((f: { name: string }) => f.name)).toEqual([
      'name',
      'email',
      'amount',
      'stage',
      'secret',
      'region',
    ]);
  });

  it('rejects bad fields with details, and duplicates with a conflict', async () => {
    const badType = await owner.post(`${API}/objects/opportunity/fields`, {
      name: 'x',
      label: 'X',
      type: 'WAT',
    });
    expect(badType.status).toBe(400);
    expect(badType.data.code).toBe('VALIDATION_FAILED');
    expect(errorCodes(badType)).toContain('type:INVALID_FIELD');
    expect(
      errorCodes(
        await owner.post(`${API}/objects/opportunity/fields`, {
          name: 'kind',
          label: 'K',
          type: 'ENUM',
        }),
      ),
    ).toEqual(['config.options:INVALID_FIELD']);
    expect(
      (
        await owner.post(`${API}/objects/opportunity/fields`, {
          name: 'region',
          label: 'Region',
          type: 'TEXT',
        })
      ).status,
    ).toBe(409);
    expect(
      (await owner.post(`${API}/objects`, { slug: 'opportunity', label: 'Deal' })).status,
    ).toBe(409);
  });

  it('uses singular names and reports unknown ones', async () => {
    const missing = await owner.get(`${API}/objects/opportunitys`);
    expect(missing.status).toBe(404);
    expect(missing.data.code).toBe('NOT_FOUND');
  });
});

describe('records', () => {
  it('creates a record owned by its creator', async () => {
    const created = expectStatus(
      await createDeal(alice, {
        name: 'Alice opportunity',
        email: 'Alice@x.com',
        amount: 100,
        stage: 'open',
        secret: 's3cret',
      }),
      201,
    );
    aliceRecord = created.id;
    expect(created.owner_id).toBe(alice.id);
    expect(created.properties.name).toBe('Alice opportunity');
    bobRecord = expectStatus(
      await createDeal(bob, {
        name: 'Bob opportunity',
        email: 'bob@x.com',
        amount: 250,
        stage: 'won',
      }),
      201,
    ).id;
  });

  it('validates against the field definitions', async () => {
    expect(errorCodes(await createDeal(alice, { email: 'x@y.com' }))).toEqual([
      'name:REQUIRED_FIELD_MISSING',
    ]);
    expect(errorCodes(await createDeal(alice, { name: 'n', nope: 1 }))).toEqual([
      'nope:UNKNOWN_FIELD',
    ]);
    expect(errorCodes(await createDeal(alice, { name: 'n', amount: '12' }))).toEqual([
      'amount:INVALID_FIELD',
    ]);
    expect(errorCodes(await createDeal(alice, { name: 'n', stage: 'maybe' }))).toEqual([
      'stage:INVALID_FIELD',
    ]);
    expect(errorCodes(await createDeal(alice, { name: 'n', email: 'not-an-email' }))).toEqual([
      'email:INVALID_FIELD',
    ]);
  });

  it('keeps unique fields unique, ignoring case', async () => {
    const dup = await createDeal(bob, { name: 'Dup', email: 'alice@X.COM' });
    expect(dup.status).toBe(400);
    expect(errorCodes(dup)).toEqual(['email:DUPLICATE_VALUE']);
  });

  it('updates partially, clears optional fields and protects required ones', async () => {
    expectStatus(
      await alice.patch(`${REC}/${aliceRecord}`, { properties: { region: 'EMEA' } }),
      200,
    );
    const updated = expectStatus(
      await alice.patch(`${REC}/${aliceRecord}`, {
        properties: { amount: 150, stage: 'won', region: null },
      }),
      200,
    );
    expect(updated.properties).toMatchObject({
      name: 'Alice opportunity',
      amount: 150,
      stage: 'won',
    });
    expect(updated.properties.region).toBeUndefined();
    expect(
      errorCodes(await alice.patch(`${REC}/${aliceRecord}`, { properties: { name: null } })),
    ).toEqual(['name:REQUIRED_FIELD_MISSING']);
    expect((await alice.patch(`${REC}/${aliceRecord}`, {})).status).toBe(400);
  });

  it('records history, redacting sensitive fields', async () => {
    const history = expectStatus(await alice.get(`${REC}/${aliceRecord}/history`), 200).results;
    const actions = history.map((h: { action: string }) => h.action);
    expect(actions).toEqual(['UPDATE', 'UPDATE', 'CREATE']);
    expect(history[0].changes).toMatchObject({
      amount: { old: 100, new: 150 },
      stage: { old: 'open', new: 'won' },
    });
    expect(history[0].actor_id).toBe(alice.id);
    const created = history[2].changes;
    expect(created.secret).toEqual({ old: '[redacted]', new: '[redacted]' });
    expect(JSON.stringify(history)).not.toContain('s3cret');
  });

  it('treats malformed ids as missing', async () => {
    expect((await alice.get(`${REC}/abc`)).status).toBe(404);
    expect((await alice.get(`${REC}/999999999999`)).status).toBe(404);
  });
});

describe('who can see and change what (default scopes)', () => {
  it("lets a manager see their reports' records, but not the reverse", async () => {
    expectStatus(await alice.get(`${REC}/${bobRecord}`), 200);
    expect((await bob.get(`${REC}/${aliceRecord}`)).status).toBe(404);
  });

  it("lets a manager read but not change a report's record", async () => {
    const denied = await alice.patch(`${REC}/${bobRecord}`, { properties: { amount: 1 } });
    expect(denied.status).toBe(403);
    expect(denied.data.code).toBe('FORBIDDEN');
    expectStatus(await bob.patch(`${REC}/${bobRecord}`, { properties: { amount: 260 } }), 200);
  });

  it('hides records from people who are not involved', async () => {
    expect((await carol.get(`${REC}/${aliceRecord}`)).status).toBe(404);
    expect(expectStatus(await carol.get(REC), 200).metadata.total_elements).toBe(0);
  });

  it('scopes lists to what each person may see', async () => {
    const total = async (user: User) =>
      expectStatus(await user.get(REC), 200).metadata.total_elements;
    expect(await total(alice)).toBe(2);
    expect(await total(bob)).toBe(1);
    expect(await total(owner)).toBe(2);
    expect(await total(admin)).toBe(2);
  });

  it('stops members deleting, even their own records', async () => {
    const denied = await bob.del(`${REC}/${bobRecord}`);
    expect(denied.status).toBe(403);
    expect(denied.data.code).toBe('FORBIDDEN');
  });

  it("lets admins change anyone's record and delete (softly)", async () => {
    expectStatus(
      await admin.patch(`${REC}/${aliceRecord}`, { properties: { region: 'APAC' } }),
      200,
    );
    const temp = expectStatus(await createDeal(alice, { name: 'Temp' }), 201).id;
    expect(expectStatus(await admin.del(`${REC}/${temp}`), 200)).toEqual({
      id: temp,
      deleted: true,
    });
    expect((await alice.get(`${REC}/${temp}`)).status).toBe(404);
    expect((await admin.del(`${REC}/${temp}`)).status).toBe(404);
  });

  it('limits who a record can be assigned to by the write scope', async () => {
    expect((await createDeal(alice, { name: 'Give away' }, { owner_id: carol.id })).status).toBe(
      403,
    );
    expect((await createDeal(alice, { name: 'To my report' }, { owner_id: bob.id })).status).toBe(
      403,
    );
    expect((await createDeal(alice, { name: 'Outside owner' }, { owner_id: eve.id })).status).toBe(
      400,
    );
    const assigned = expectStatus(
      await createDeal(owner, { name: 'For carol' }, { owner_id: carol.id }),
      201,
    );
    expect(assigned.owner_id).toBe(carol.id);
    expectStatus(await carol.get(`${REC}/${assigned.id}`), 200);
  });
});

describe('role scope overrides', () => {
  it('keeps access settings to people who may manage them', async () => {
    expect(
      (await alice.put(`${API}/access/roles/member`, { read_scope: 'ALL', write_scope: 'ALL' }))
        .status,
    ).toBe(403);
    // Members may look at the settings (the member role has ac:read), just not change them.
    expect((await alice.get(`${API}/access/roles`)).status).toBe(200);
  });

  it('refuses to override the owner and admin roles, or unknown roles and scopes', async () => {
    expect(
      (await owner.put(`${API}/access/roles/admin`, { read_scope: 'OWN', write_scope: 'OWN' })).data
        .code,
    ).toBe('ROLE_FIXED');
    expect(
      (await owner.put(`${API}/access/roles/wizard`, { read_scope: 'OWN', write_scope: 'OWN' }))
        .data.code,
    ).toBe('UNKNOWN_ROLE');
    expect(
      (
        await owner.put(`${API}/access/roles/member`, {
          read_scope: 'EVERYONE',
          write_scope: 'OWN',
        })
      ).data.code,
    ).toBe('VALIDATION_FAILED');
    expect(
      (
        await owner.put(`${API}/access/roles/member`, {
          object: 'nothing',
          read_scope: 'OWN',
          write_scope: 'OWN',
        })
      ).status,
    ).toBe(404);
  });

  it('reports the built-in defaults', async () => {
    const settings = expectStatus(await owner.get(`${API}/access/roles`), 200);
    expect(settings.defaults.member).toEqual({ read_scope: 'OWN_AND_REPORTS', write_scope: 'OWN' });
    expect(settings.defaults.owner).toEqual({ read_scope: 'ALL', write_scope: 'ALL' });
    expect(settings.overrides).toEqual([]);
  });

  it('switches an object to team scope, then back', async () => {
    expectStatus(
      await owner.put(`${API}/access/roles/member`, {
        object: 'opportunity',
        read_scope: 'TEAM',
        write_scope: 'TEAM',
      }),
      200,
    );

    const teamDeal = expectStatus(
      await createDeal(dave, { name: 'Team opportunity' }, { team_id: salesId }),
      201,
    );
    expect(teamDeal.team_id).toBe(salesId);
    expectStatus(await carol.get(`${REC}/${teamDeal.id}`), 200); // same team
    expectStatus(await carol.patch(`${REC}/${teamDeal.id}`, { properties: { amount: 5 } }), 200); // TEAM write
    expect((await alice.get(`${REC}/${bobRecord}`)).status).toBe(404); // reports no longer count
    expectStatus(await bob.get(`${REC}/${bobRecord}`), 200); // own records always do
    expect((await alice.get(`${REC}/${teamDeal.id}`)).status).toBe(404); // not in the team

    // A team member can only put records in a team they belong to.
    expect((await createDeal(alice, { name: 'Wrong team' }, { team_id: salesId })).status).toBe(
      403,
    );

    expect(expectStatus(await owner.get(`${API}/access/roles`), 200).overrides).toEqual([
      { role: 'member', object: 'opportunity', read_scope: 'TEAM', write_scope: 'TEAM' },
    ]);
    expect(
      expectStatus(await owner.del(`${API}/access/roles/member?object=opportunity`), 200).removed,
    ).toBe(1);
    expectStatus(await alice.get(`${REC}/${bobRecord}`), 200); // back to defaults
  });

  it('supports a role-wide override that an object override beats', async () => {
    expectStatus(
      await owner.put(`${API}/access/roles/member`, { read_scope: 'ALL', write_scope: 'OWN' }),
      200,
    );
    expectStatus(await carol.get(`${REC}/${aliceRecord}`), 200); // ALL read
    expect((await carol.patch(`${REC}/${aliceRecord}`, { properties: { amount: 1 } })).status).toBe(
      403,
    ); // OWN write

    expectStatus(
      await owner.put(`${API}/access/roles/member`, {
        object: 'opportunity',
        read_scope: 'OWN',
        write_scope: 'OWN',
      }),
      200,
    );
    expect((await carol.get(`${REC}/${aliceRecord}`)).status).toBe(404); // object override wins

    await owner.del(`${API}/access/roles/member?object=opportunity`);
    await owner.del(`${API}/access/roles/member`);
    expect(expectStatus(await owner.get(`${API}/access/roles`), 200).overrides).toEqual([]);
  });
});

describe('record shares', () => {
  const shares = () => `${REC}/${aliceRecord}/shares`;
  let carolShare = '';

  it('rejects shares to people outside the organization, or without exactly one target', async () => {
    expect(errorCodes(await alice.post(shares(), { user_id: eve.id, access: 'READ' }))).toEqual([
      'user_id:INVALID_FIELD',
    ]);
    expect(
      (await alice.post(shares(), { user_id: carol.id, team_id: salesId, access: 'READ' })).status,
    ).toBe(400);
    expect((await alice.post(shares(), { access: 'READ' })).status).toBe(400);
    expect((await alice.post(shares(), { user_id: carol.id, access: 'OWNER' })).status).toBe(400);
  });

  it('gives a user read access to one record', async () => {
    expect((await carol.get(`${REC}/${aliceRecord}`)).status).toBe(404);
    const share = expectStatus(
      await alice.post(shares(), { user_id: carol.id, access: 'READ' }),
      201,
    );
    carolShare = share.id;
    expect(share).toMatchObject({
      user_id: carol.id,
      team_id: null,
      access: 'READ',
      created_by: alice.id,
    });

    expectStatus(await carol.get(`${REC}/${aliceRecord}`), 200);
    expect((await carol.patch(`${REC}/${aliceRecord}`, { properties: { amount: 1 } })).status).toBe(
      403,
    );
    expect((await carol.post(shares(), { user_id: dave.id, access: 'READ' })).status).toBe(403); // cannot re-share
    const listed = expectStatus(await carol.get(REC), 200).results.map((r: { id: string }) => r.id);
    expect(listed).toContain(aliceRecord);
  });

  it('does not share twice with the same user', async () => {
    expect((await alice.post(shares(), { user_id: carol.id, access: 'WRITE' })).status).toBe(409);
    expect(expectStatus(await alice.get(shares()), 200).results).toHaveLength(1);
  });

  it('upgrades to write access by replacing the share', async () => {
    expectStatus(await alice.del(`${shares()}/${carolShare}`), 200);
    expect((await carol.get(`${REC}/${aliceRecord}`)).status).toBe(404);
    carolShare = expectStatus(
      await alice.post(shares(), { user_id: carol.id, access: 'WRITE' }),
      201,
    ).id;
    expectStatus(await carol.patch(`${REC}/${aliceRecord}`, { properties: { amount: 175 } }), 200);
  });

  it('shares with a whole team', async () => {
    expect((await dave.get(`${REC}/${aliceRecord}`)).status).toBe(404);
    const teamShare = expectStatus(
      await alice.post(shares(), { team_id: salesId, access: 'READ' }),
      201,
    );
    expectStatus(await dave.get(`${REC}/${aliceRecord}`), 200);
    expect((await dave.patch(`${REC}/${aliceRecord}`, { properties: { amount: 1 } })).status).toBe(
      403,
    );

    expectStatus(await alice.del(`${shares()}/${teamShare.id}`), 200);
    expectStatus(await alice.del(`${shares()}/${carolShare}`), 200);
    expect((await dave.get(`${REC}/${aliceRecord}`)).status).toBe(404);
    expect((await carol.get(`${REC}/${aliceRecord}`)).status).toBe(404);
    expect((await alice.del(`${shares()}/${carolShare}`)).status).toBe(404);
  });

  it('writes share changes into the record history', async () => {
    const history = expectStatus(await alice.get(`${REC}/${aliceRecord}/history`), 200).results;
    const sharing = history.filter((h: { changes: object }) => 'shared_with' in h.changes).length;
    expect(sharing).toBe(6); // 3 shares added and 3 removed
  });
});

describe('listing and filtering', () => {
  beforeAll(async () => {
    for (const [i, stage] of ['open', 'won', 'won', 'lost'].entries()) {
      expectStatus(
        await createDeal(owner, { name: `Filter ${'ABCD'[i]}`, amount: (i + 1) * 10, stage }),
        201,
      );
    }
  });

  const filter = (user: User, filters: object[], extra: object = {}) =>
    user.post(`${REC}/filter`, { filter_groups: [{ logical_operator: 'AND', filters }], ...extra });
  const names = (data: { results: { properties: { name: string } }[] }) =>
    data.results.map((r) => r.properties.name);
  const isFilterRow = { field_path: 'name', operator: 'STARTS_WITH', value: 'Filter ' };

  it('returns facet counts over matching visible records and rejects unavailable fields', async () => {
    const body = { field: 'stage', filter_groups: [{ filters: [isFilterRow] }] };
    expect(expectStatus(await owner.post(`${REC}/facets`, body), 200)).toEqual({
      results: [
        { value: 'won', count: 2 },
        { value: 'lost', count: 1 },
        { value: 'open', count: 1 },
      ],
      truncated: false,
    });
    expect(expectStatus(await bob.post(`${REC}/facets`, body), 200).results).toEqual([]);
    expect(expectStatus(await eve.post(`${REC}/facets`, body), 404).code).toBe('NOT_FOUND');
    for (const field of ['secret', 'email', 'missing'])
      expect((await owner.post(`${REC}/facets`, { ...body, field })).status).toBe(400);
  });

  it('supports blanks together with typed values in checklist filters', async () => {
    const blank = expectStatus(await createDeal(owner, { name: 'Blank checklist' }), 201);
    try {
      const selected = expectStatus(
        await filter(owner, [{ field_path: 'amount', operator: 'IN', values: [null, 20] }]),
        200,
      );
      expect(selected.results.some((record: { id: string }) => record.id === blank.id)).toBe(true);
      expect(names(selected)).toContain('Filter B');
      const excluded = expectStatus(
        await filter(owner, [{ field_path: 'amount', operator: 'NOT_IN', values: [null, 20] }]),
        200,
      );
      expect(excluded.results.some((record: { id: string }) => record.id === blank.id)).toBe(false);
      expect(names(excluded)).not.toContain('Filter B');
    } finally {
      expectStatus(await owner.del(`${REC}/${blank.id}`), 200);
    }
  });

  it('filters with every comparison and combines groups', async () => {
    expect(
      names(
        expectStatus(
          await filter(
            owner,
            [
              isFilterRow,
              { field_path: 'amount', operator: 'GREATER_THAN_OR_EQUAL_TO', value: 20 },
            ],
            { sort: { field: 'amount', direction: 'ASC' } },
          ),
          200,
        ),
      ),
    ).toEqual(['Filter B', 'Filter C', 'Filter D']);
    expect(
      names(
        expectStatus(
          await filter(
            owner,
            [isFilterRow, { field_path: 'stage', operator: 'IN', values: ['won', 'lost'] }],
            { sort: { field: 'amount', direction: 'DESC' } },
          ),
          200,
        ),
      ),
    ).toEqual(['Filter D', 'Filter C', 'Filter B']);
    expect(
      names(
        expectStatus(
          await filter(
            owner,
            [isFilterRow, { field_path: 'amount', operator: 'BETWEEN', values: [15, 35] }],
            { sort: { field: 'amount', direction: 'ASC' } },
          ),
          200,
        ),
      ),
    ).toEqual(['Filter B', 'Filter C']);
    const or = await owner.post(`${REC}/filter`, {
      filter_groups: [
        { filters: [{ field_path: 'name', operator: 'EQUALS', value: 'Filter A' }] },
        { filters: [{ field_path: 'name', operator: 'EQUALS', value: 'Filter D' }] },
      ],
      sort: { field: 'amount', direction: 'asc' },
    });
    expect(names(expectStatus(or, 200))).toEqual(['Filter A', 'Filter D']);
  });

  it('pages and reports totals', async () => {
    const page = expectStatus(
      await filter(owner, [isFilterRow], {
        sort: { field: 'amount', direction: 'ASC' },
        pagination: { page: 2, page_size: 3 },
      }),
      200,
    );
    expect(page.results).toHaveLength(1);
    expect(page.metadata).toEqual({
      page: 2,
      page_size: 3,
      total_elements: 4,
      total_pages: 2,
      has_next: false,
      has_previous: true,
    });
    expect(expectStatus(await owner.get(`${REC}?page_size=1000`), 200).metadata.page_size).toBe(
      100,
    );
    const list = expectStatus(await owner.get(`${REC}?sort=amount,desc&page_size=2`), 200);
    expect(list.results[0].properties.amount).toBeGreaterThanOrEqual(
      list.results[1].properties.amount,
    );
  });

  it('only counts and returns what the caller may see', async () => {
    const mine = expectStatus(await filter(bob, [isFilterRow]), 200);
    expect(mine.metadata.total_elements).toBe(0);
    expect(expectStatus(await filter(admin, [isFilterRow]), 200).metadata.total_elements).toBe(4);
  });

  it('filters on when a record was created and changed, as UTC instants', async () => {
    const inMinutes = (n: number) => new Date(Date.now() + n * 60_000).toISOString();
    const created = [
      { field_path: 'created_at', operator: 'GREATER_THAN', value: inMinutes(-10) },
      { field_path: 'created_at', operator: 'LESS_THAN', value: inMinutes(10) },
    ];
    // Just made, so created within the last ten minutes and not before that or after now: a
    // timezone offset of even an hour would put these out.
    expect(names(expectStatus(await filter(owner, [isFilterRow, ...created]), 200)).sort()).toEqual(
      ['Filter A', 'Filter B', 'Filter C', 'Filter D'],
    );
    expect(
      names(
        expectStatus(
          await filter(owner, [
            isFilterRow,
            { field_path: 'created_at', operator: 'LESS_THAN', value: inMinutes(-10) },
          ]),
          200,
        ),
      ),
    ).toEqual([]);
    expect(
      names(
        expectStatus(
          await filter(owner, [
            isFilterRow,
            { field_path: 'updated_at', operator: 'GREATER_THAN', value: inMinutes(10) },
          ]),
          200,
        ),
      ),
    ).toEqual([]);
    expect(
      names(
        expectStatus(
          await filter(owner, [
            isFilterRow,
            {
              field_path: 'updated_at',
              operator: 'BETWEEN',
              values: [inMinutes(-10), inMinutes(10)],
            },
          ]),
          200,
        ),
      ),
    ).toHaveLength(4);
  });

  it('only filters or sorts on filterable fields', async () => {
    expect(
      errorCodes(await filter(owner, [{ field_path: 'email', operator: 'EQUALS', value: 'x' }])),
    ).toEqual(['email:INVALID_FIELD']);
    expect(errorCodes(await owner.get(`${REC}?sort=email,asc`))).toEqual([
      'email:INVALID_SORT_FIELD',
    ]);
    expect(
      errorCodes(await filter(owner, [{ field_path: 'amount', operator: 'CONTAINS', value: '1' }])),
    ).toEqual(['amount:INVALID_FIELD']);
  });
});

describe('tenant isolation', () => {
  it("keeps one organization's schema and data invisible to another", async () => {
    expect(
      expectStatus(await eve.get(`${API}/objects`), 200).results.map(
        (o: { name: string }) => o.name,
      ),
    ).toEqual(['contact', 'company', 'deal', 'prospect', 'lead']);
    expect((await eve.get(`${REC}`)).status).toBe(404);

    const evesDeal = expectStatus(
      await eve.post(`${API}/objects`, { slug: 'opportunity', label: 'Deal' }),
      201,
    );
    const acmeDeal = expectStatus(await owner.get(`${API}/objects/opportunity`), 200);
    expect(evesDeal.id).not.toBe(acmeDeal.id);
    expect(expectStatus(await eve.get(`${REC}`), 200).metadata.total_elements).toBe(0);
    expect((await eve.get(`${REC}/${aliceRecord}`)).status).toBe(404); // another org's id
  });

  it('cannot switch into an organization you do not belong to', async () => {
    const reply = await eve.post('/auth/organization/set-active', { organizationId: orgId });
    expect(reply.status).toBeGreaterThanOrEqual(400);

    // better-auth drops the active organization after a rejected switch. Either way,
    // she must never end up in Acme.
    const me = await eve.get(`${API}/me`);
    expect(me.data.organization_id).not.toBe(orgId);
    expect((await eve.get(REC)).status).not.toBe(200);
    expectStatus(await eve.signIn(), 200); // a new session starts back in her own organization
    expect(expectStatus(await eve.get(`${API}/me`), 200).organization_id).toBe(eveOrgId);
  });

  it('is enforced by the database itself, not only by the API', async () => {
    await withDb(async (db) => {
      await db.query('BEGIN');
      await db.query('SET LOCAL ROLE zuko_app');
      expect(Number((await db.query('SELECT count(*) FROM object_record')).rows[0].count)).toBe(0); // no tenant, no rows
      await db.query("SELECT set_config('app.org_id', $1, true)", [eveOrgId]);
      expect(Number((await db.query('SELECT count(*) FROM object_record')).rows[0].count)).toBe(0); // eve has none
      await db.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
      expect(
        Number((await db.query('SELECT count(*) FROM object_record')).rows[0].count),
      ).toBeGreaterThan(5);
      await db.query('ROLLBACK');
    });
  });

  it('asks for an organization and for a login', async () => {
    expectStatus(await loner.signIn(), 200);
    const noOrg = await loner.get(`${API}/objects`);
    expect(noOrg.status).toBe(400);
    expect(noOrg.data.code).toBe('NO_ACTIVE_ORGANIZATION');
    expect((await new User('nobody', 'nobody@example.com').get(`${API}/objects`)).status).toBe(401);
  });
});

describe('audit', () => {
  it('records organization, membership, team and reporting events with actors', async () => {
    await withDb(async (db) => {
      const rows = (
        await db.query(
          'SELECT event, "actorId"::text AS actor, metadata::text AS metadata FROM audit_event WHERE "organizationId" = $1',
          [orgId],
        )
      ).rows;
      const events = new Set(rows.map((r) => r.event));
      for (const event of [
        'organization.created',
        'member.invited',
        'invitation.accepted',
        'team.created',
        'team.member_added',
        'hierarchy.manager_set',
      ]) {
        expect(events, `missing ${event}`).toContain(event);
      }
      expect(rows.find((r) => r.event === 'organization.created')?.actor).toBe(owner.id);
      expect(JSON.stringify(rows)).not.toContain('correct-horse-battery');
    });
  });

  it('records failed sign-ins without the password', async () => {
    const reply = await new User('loner', loner.email).post('/auth/sign-in/email', {
      email: loner.email,
      password: 'definitely-wrong-1',
    });
    expect(reply.status).toBe(401);
    await withDb(async (db) => {
      const rows = (
        await db.query(
          `SELECT "actorType", metadata::text AS metadata FROM audit_event WHERE event = 'user.sign_in_failed' AND metadata->>'email' = $1`,
          [loner.email],
        )
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].actorType).toBe('ANONYMOUS');
      expect(rows[0].metadata).not.toContain('definitely-wrong');
    });
  });

  it('keeps a change log for records, including deletes and who did them', async () => {
    await withDb(async (db) => {
      const rows = (
        await db.query(
          'SELECT action, "actorId"::text AS actor FROM record_change WHERE "organizationId" = $1',
          [orgId],
        )
      ).rows;
      const actions = new Set(rows.map((r) => r.action));
      expect([...actions].sort()).toEqual(['CREATE', 'DELETE', 'UPDATE']);
      expect(rows.some((r) => r.action === 'DELETE' && r.actor === admin.id)).toBe(true);
      expect(rows.some((r) => r.action === 'CREATE' && r.actor === alice.id)).toBe(true);
    });
  });

  it('cannot be rewritten, even by the database login', async () => {
    await withDb(async (db) => {
      await expect(
        db.query(`UPDATE audit_event SET event = 'tampered' WHERE "organizationId" = $1`, [orgId]),
      ).rejects.toThrow(/append-only/);
      await expect(
        db.query('DELETE FROM record_change WHERE "organizationId" = $1', [orgId]),
      ).rejects.toThrow(/append-only/);
    });
  });
});
