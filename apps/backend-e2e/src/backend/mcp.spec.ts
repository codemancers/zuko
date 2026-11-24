import axios from 'axios';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, withDb } from '../support/crm-client';
import {
  BASE,
  MCP_URL,
  connect,
  deny,
  openSession,
  registerClient,
  type Connection,
} from '../support/mcp-client';

/**
 * MCP end to end: an MCP client discovers the server, registers, is authorized by a user,
 * and then works through the official MCP client with the access token. Run alongside
 * crm.spec.ts by `nx e2e @zuko/backend-e2e`.
 *
 *   Acme:  owner (owner), alice (member)      Beta: owner's second organization
 */
const run = Date.now().toString(36);
const suffix = `-${run}@mcp.test`;
const slugs = [`mcp-acme-${run}`, `mcp-beta-${run}`, `mcp-link-${run}`];
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');
const linker = mk('linker'); // alone in an organization with the standard objects

const API = '/api/v1';
let acmeId = '';
let betaId = '';
const clientName = (label: string) => `e2e-${run}-${label}`;

function status(reply: { status: number; data?: unknown }, expected: number) {
  if (reply.status !== expected) {
    throw new Error(`Expected ${expected} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  }
  return reply.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

beforeAll(async () => {
  for (const user of [owner, alice, linker]) {
    status(await user.signUp(), 200);
  }
  await verifyEmails(suffix);
  acmeId = status(
    await owner.post('/auth/organization/create', { name: 'Acme', slug: slugs[0] }),
    200,
  ).id;

  const invite = status(
    await owner.post('/auth/organization/invite-member', {
      email: alice.email,
      role: 'member',
      organizationId: acmeId,
    }),
    200,
  );
  status(
    await alice.post('/auth/organization/accept-invitation', { invitationId: invite.id }),
    200,
  );
  status(await alice.signIn(), 200);

  status(await linker.post('/auth/organization/create', { name: 'Link Co', slug: slugs[2] }), 200);

  // Customize the provisioned schema for the record and permission tests below.
  status(
    await owner.patch(`${API}/objects/deal/fields/stage`, {
      config: { options: ['open', 'won', 'lost'] },
    }),
    200,
  );
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs, `e2e-${run}-`);
}, 60_000);

describe('discovery', () => {
  it('challenges an unauthenticated request and points at the protected-resource metadata', async () => {
    const res = await axios.post(
      MCP_URL,
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      {
        headers: { accept: 'application/json, text/event-stream' },
        validateStatus: () => true,
      },
    );
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toContain(
      `resource_metadata="${BASE}/.well-known/oauth-protected-resource/api/mcp"`,
    );
    expect(res.headers['www-authenticate']).toContain('mcp:read');
  });

  it('publishes the protected resource and its authorization server at the origin root', async () => {
    const resource = (await axios.get(`${BASE}/.well-known/oauth-protected-resource/api/mcp`)).data;
    expect(resource.resource).toBe(MCP_URL);
    expect(resource.scopes_supported).toEqual(['mcp:read', 'mcp:write', 'mcp:delete']);
    expect(resource.authorization_servers).toEqual([`${BASE}/auth`]);

    const server = (await axios.get(`${BASE}/.well-known/oauth-authorization-server/auth`)).data;
    expect(server.issuer).toBe(`${BASE}/auth`);
    expect(server.registration_endpoint).toBe(`${BASE}/auth/oauth2/register`);
    expect(server.code_challenge_methods_supported).toContain('S256');
    expect(server.grant_types_supported).toEqual(
      expect.arrayContaining(['authorization_code', 'refresh_token']),
    );
  });
});

describe('registration', () => {
  it('registers a native client', async () => {
    const res = await registerClient(clientName('register'), 'mcp:read');
    expect(res.status).toBe(201);
    expect(res.data.client_id).toBeTruthy();
    // The registered list is the most the client may ask for; what a connection actually
    // gets is decided at authorization (see 'what a connection may do').
    expect(res.data.scope).toContain('mcp:read');
  });

  it('refuses scopes that are not offered, and insecure redirects for web clients', async () => {
    expect(
      (await registerClient(clientName('bad-scope'), 'mcp:read admin:everything')).status,
    ).toBe(400);
    const web = await registerClient(clientName('web'), 'mcp:read', { application_type: 'web' });
    expect(web.status).toBe(400);
    expect(web.data.error).toBe('invalid_redirect_uri');
  });
});

describe('connecting', () => {
  let conn: Connection;

  it('issues a token for the user, bound to the organization active at the time', async () => {
    conn = await connect(alice, clientName('alice'), 'openid offline_access mcp:read mcp:write');
    expect(conn.scope.split(' ').sort()).toEqual(['mcp:read', 'mcp:write']);
    expect(conn.claims['sub']).toBe(alice.id);
    expect(conn.claims['urn:zuko:org_id']).toBe(acmeId);
    expect(conn.claims['aud']).toContain(MCP_URL);
    expect(conn.claims['azp']).toBe(conn.clientId);
    expect(conn.refreshToken).toBeTruthy();
  });

  it('refreshes the token without asking the user again', async () => {
    const res = await alice.form('/auth/oauth2/token', {
      grant_type: 'refresh_token',
      refresh_token: conn.refreshToken,
      client_id: conn.clientId,
      resource: MCP_URL,
    });
    expect(res.status).toBe(200);
    expect(res.data.access_token).toBeTruthy();
    const claims = JSON.parse(
      Buffer.from(res.data.access_token.split('.')[1], 'base64url').toString(),
    );
    expect(claims['urn:zuko:org_id']).toBe(acmeId);
  });

  it('rejects garbage and wrongly signed tokens', async () => {
    for (const token of ['not-a-token', `${conn.accessToken.slice(0, -4)}AAAA`]) {
      const res = await axios.post(
        MCP_URL,
        { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        {
          headers: {
            accept: 'application/json, text/event-stream',
            authorization: `Bearer ${token}`,
          },
          validateStatus: () => true,
        },
      );
      expect(res.status).toBe(401);
    }
  });
});

describe('tools', () => {
  let owned: Connection;
  let mcp: Awaited<ReturnType<typeof openSession>>;
  let recordId = '';

  beforeAll(async () => {
    owned = await connect(owner, clientName('owner-full'), 'openid mcp:read mcp:write mcp:delete');
    mcp = await openSession(owned.accessToken);
  });
  afterAll(async () => {
    await mcp.close();
  });

  it('lists the tools with honest annotations', async () => {
    const tools = await mcp.tools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'create_record',
      'delete_record',
      'describe_object_type',
      'filter_records',
      'get_record',
      'get_record_history',
      'link_record',
      'list_linked_records',
      'list_members',
      'list_object_types',
      'list_records',
      'list_teams',
      'unlink_record',
      'update_record',
    ]);
    const byName = Object.fromEntries(tools.map((t) => [t.name, t.annotations ?? {}]));
    expect(byName['list_records']).toMatchObject({ readOnlyHint: true });
    expect(byName['delete_record']).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(byName['create_record']).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  });

  it('reads the schema and the directory', async () => {
    expect(
      (await mcp.call('list_object_types')).data.results.map((o: { name: string }) => o.name),
    ).toEqual(['contact', 'company', 'deal']);
    const described = (await mcp.call('describe_object_type', { object: 'deal' })).data;
    expect(described.fields.map((f: { name: string }) => f.name)).toEqual([
      'name',
      'amount',
      'stage',
      'expected_close_date',
      'companies',
    ]);
    const members = (await mcp.call('list_members')).data.results;
    expect(members.map((m: { email: string }) => m.email).sort()).toEqual([
      alice.email,
      owner.email,
    ]);
    expect(members.find((m: { is_me: boolean }) => m.is_me).email).toBe(owner.email);
    expect((await mcp.call('list_teams')).data.results).toEqual([
      expect.objectContaining({ name: 'Acme' }),
    ]);
  });

  it('creates, reads, updates, filters, lists and deletes records', async () => {
    const created = await mcp.call('create_record', {
      object: 'deal',
      properties: { name: 'Via MCP', amount: 10, stage: 'open' },
    });
    expect(created.isError).toBe(false);
    recordId = created.data.id;
    expect(created.data.owner_id).toBe(owner.id);

    expect(
      (await mcp.call('get_record', { object: 'deal', id: recordId })).data.properties.name,
    ).toBe('Via MCP');
    const updated = await mcp.call('update_record', {
      object: 'deal',
      id: recordId,
      properties: { amount: 25, stage: 'won' },
    });
    expect(updated.data.properties).toMatchObject({ amount: 25, stage: 'won' });

    const found = await mcp.call('filter_records', {
      object: 'deal',
      filter_groups: [{ filters: [{ field_path: 'stage', operator: 'EQUALS', value: 'won' }] }],
    });
    expect(found.data.results.map((r: { id: string }) => r.id)).toEqual([recordId]);
    const listed = await mcp.call('list_records', {
      object: 'deal',
      page_size: 5,
      sort: 'amount,desc',
    });
    expect(listed.data.metadata.total_elements).toBe(1);

    expect((await mcp.call('delete_record', { object: 'deal', id: recordId })).data).toEqual({
      id: recordId,
      deleted: true,
    });
    const gone = await mcp.call('get_record', { object: 'deal', id: recordId });
    expect(gone.isError).toBe(true);
    expect(gone.data.code).toBe('NOT_FOUND');
  });

  it('returns validation problems the model can act on', async () => {
    const bad = await mcp.call('create_record', {
      object: 'deal',
      properties: { amount: 'lots', unknown: 1 },
    });
    expect(bad.isError).toBe(true);
    expect(bad.data.code).toBe('VALIDATION_FAILED');
    expect(
      bad.data.errors.map((e: { field: string; code: string }) => `${e.field}:${e.code}`).sort(),
    ).toEqual(['amount:INVALID_FIELD', 'name:REQUIRED_FIELD_MISSING', 'unknown:UNKNOWN_FIELD']);
    expect((await mcp.call('describe_object_type', { object: 'deals' })).data.code).toBe(
      'NOT_FOUND',
    );
  });

  it('records MCP as the actor in the history', async () => {
    const made = (
      await mcp.call('create_record', { object: 'deal', properties: { name: 'History' } })
    ).data.id;
    await mcp.call('update_record', { object: 'deal', id: made, properties: { amount: 1 } });
    const viaWeb = status(
      await owner.patch(`${API}/objects/deal/records/${made}`, { properties: { amount: 2 } }),
      200,
    );
    expect(viaWeb.properties.amount).toBe(2);

    const history = (await mcp.call('get_record_history', { object: 'deal', id: made })).data
      .results;
    expect(
      history.map((h: { action: string; actor_type: string }) => `${h.action}:${h.actor_type}`),
    ).toEqual(['UPDATE:USER', 'UPDATE:MCP', 'CREATE:MCP']);
  });
});

describe('linking records', () => {
  let mcp: Awaited<ReturnType<typeof openSession>>;
  let contact = '';
  let company = '';

  beforeAll(async () => {
    mcp = await openSession(
      (await connect(linker, clientName('linker'), 'mcp:read mcp:write')).accessToken,
    );
    contact = (
      await mcp.call('create_record', {
        object: 'contact',
        properties: { first_name: 'Ada', last_name: 'Lovelace' },
      })
    ).data.id;
    company = (
      await mcp.call('create_record', {
        object: 'company',
        properties: { name: 'Analytical Engines' },
      })
    ).data.id;
  });
  afterAll(async () => {
    await mcp.close();
  });

  it('says which kinds of record can be linked', async () => {
    const described = (await mcp.call('describe_object_type', { object: 'contact' })).data;
    expect(described.associations.map((a: { name: string }) => a.name)).toEqual([
      'contact_company',
      'contact_deal',
    ]);
  });

  it('links two records, shows the link from both sides, and unlinks them', async () => {
    const linked = await mcp.call('link_record', {
      object: 'contact',
      id: contact,
      link: 'contact_company',
      record_id: company,
    });
    expect(linked.isError).toBe(false);
    expect(linked.data.results).toEqual([{ id: company, label: 'Analytical Engines' }]);

    const fromContact = (
      await mcp.call('list_linked_records', {
        object: 'contact',
        id: contact,
        link: 'contact_company',
      })
    ).data;
    expect(fromContact.results.map((r: { id: string; label: string }) => [r.id, r.label])).toEqual([
      [company, 'Analytical Engines'],
    ]);
    const fromCompany = (
      await mcp.call('list_linked_records', {
        object: 'company',
        id: company,
        link: 'contact_company',
      })
    ).data;
    expect(fromCompany.results.map((r: { label: string }) => r.label)).toEqual(['Ada Lovelace']);

    const withLinks = (await mcp.call('list_records', { object: 'contact', include_links: true }))
      .data.results[0];
    expect(withLinks.associations.contact_company).toEqual([
      { id: company, label: 'Analytical Engines' },
    ]);
    const found = (
      await mcp.call('filter_records', {
        object: 'contact',
        include_links: true,
        filter_groups: [
          { filters: [{ field_path: 'first_name', operator: 'EQUALS', value: 'Ada' }] },
        ],
      })
    ).data;
    expect(found.results[0].associations.contact_company).toHaveLength(1);

    expect(
      (
        await mcp.call('unlink_record', {
          object: 'contact',
          id: contact,
          link: 'contact_company',
          record_id: company,
        })
      ).data.results,
    ).toEqual([]);
    expect(
      (
        await mcp.call('list_linked_records', {
          object: 'contact',
          id: contact,
          link: 'contact_company',
        })
      ).data.results,
    ).toEqual([]);
  });

  it('reports what went wrong in a way the model can act on', async () => {
    expect(
      (
        await mcp.call('link_record', {
          object: 'contact',
          id: contact,
          link: 'deal_company',
          record_id: contact,
        })
      ).data.code,
    ).toBe('NOT_FOUND');
    expect(
      (
        await mcp.call('link_record', {
          object: 'contact',
          id: contact,
          link: 'contact_company',
          record_id: '999999999',
        })
      ).data.code,
    ).toBe('NOT_FOUND');
    expect(
      (
        await mcp.call('unlink_record', {
          object: 'contact',
          id: contact,
          link: 'contact_company',
          record_id: company,
        })
      ).data.code,
    ).toBe('NOT_FOUND'); // not linked
  });

  it('needs the write scope to change links, but not to read them', async () => {
    const readOnly = await openSession(
      (await connect(linker, clientName('linker-read'), 'mcp:read')).accessToken,
    );
    expect(
      (
        await readOnly.call('list_linked_records', {
          object: 'contact',
          id: contact,
          link: 'contact_company',
        })
      ).isError,
    ).toBe(false);
    for (const tool of ['link_record', 'unlink_record'] as const) {
      const denied = await readOnly.call(tool, {
        object: 'contact',
        id: contact,
        link: 'contact_company',
        record_id: company,
      });
      expect({ tool, code: denied.data.code }).toEqual({ tool, code: 'INSUFFICIENT_SCOPE' });
    }
    await readOnly.close();
  });
});

describe('what a connection may do', () => {
  it('needs the matching scope, whoever the user is', async () => {
    const readOnly = await openSession(
      (await connect(owner, clientName('owner-read'), 'mcp:read')).accessToken,
    );
    const made = status(
      await owner.post(`${API}/objects/deal/records`, { properties: { name: 'Scoped' } }),
      201,
    ).id;

    expect((await readOnly.call('get_record', { object: 'deal', id: made })).isError).toBe(false);
    for (const [tool, args] of [
      ['create_record', { object: 'deal', properties: { name: 'No' } }],
      ['update_record', { object: 'deal', id: made, properties: { amount: 1 } }],
      ['delete_record', { object: 'deal', id: made }],
    ] as const) {
      const denied = await readOnly.call(tool, args);
      expect({ tool, isError: denied.isError, code: denied.data.code }).toEqual({
        tool,
        isError: true,
        code: 'INSUFFICIENT_SCOPE',
      });
    }
    await readOnly.close();
  });

  it("is limited by the user's own permissions, even with every scope", async () => {
    const aliceFull = await openSession(
      (await connect(alice, clientName('alice-full'), 'mcp:read mcp:write mcp:delete')).accessToken,
    );
    const ownerRecord = status(
      await owner.post(`${API}/objects/deal/records`, { properties: { name: 'Owner only' } }),
      201,
    ).id;

    const mine = (
      await aliceFull.call('create_record', { object: 'deal', properties: { name: 'Alice deal' } })
    ).data.id;
    expect(
      (await aliceFull.call('get_record', { object: 'deal', id: ownerRecord })).data.code,
    ).toBe('NOT_FOUND'); // cannot see it
    const list = (await aliceFull.call('list_records', { object: 'deal' })).data;
    expect(list.results.map((r: { id: string }) => r.id)).toContain(mine);
    expect(list.results.map((r: { id: string }) => r.id)).not.toContain(ownerRecord);

    const denied = await aliceFull.call('delete_record', { object: 'deal', id: mine }); // members cannot delete
    expect(denied.isError).toBe(true);
    expect(denied.data.code).toBe('FORBIDDEN');
    await aliceFull.close();
  });
});

describe('organization binding', () => {
  it('keeps a connection in the organization it was made for', async () => {
    const forAcme = await connect(owner, clientName('bound-acme'), 'mcp:read');
    expect(forAcme.claims['urn:zuko:org_id']).toBe(acmeId);

    // The owner creates and switches to a second organization in the web app.
    betaId = status(
      await owner.post('/auth/organization/create', { name: 'Beta', slug: slugs[1] }),
      200,
    ).id;
    expect(status(await owner.get(`${API}/me`), 200).organization_id).toBe(betaId);

    const acme = await openSession(forAcme.accessToken);
    expect(
      (await acme.call('list_object_types')).data.results.map((o: { name: string }) => o.name),
    ).toEqual(['contact', 'company', 'deal']);
    await acme.close();

    const forBeta = await connect(owner, clientName('bound-beta'), 'mcp:read');
    expect(forBeta.claims['urn:zuko:org_id']).toBe(betaId);
    const beta = await openSession(forBeta.accessToken);
    expect(
      (await beta.call('list_object_types')).data.results.map((o: { name: string }) => o.name),
    ).toEqual(['contact', 'company', 'deal']);
    await beta.close();

    status(await owner.post('/auth/organization/set-active', { organizationId: acmeId }), 200);
  });
});

describe('connected applications', () => {
  let connA: Connection;
  let connB: Connection;
  let idA = '';
  let idB = '';
  const mine = async (user: User) =>
    (
      status(await user.get(`${API}/connections`), 200).results as {
        id: string;
        client: { id: string; name: string };
        organization: { id: string; name: string };
        scopes: string[];
        connected_at: string;
      }[]
    ).filter((c) => c.client.name?.startsWith(`e2e-${run}-conn`));
  const callMcp = (token: string) =>
    axios.post(
      MCP_URL,
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      {
        headers: {
          accept: 'application/json, text/event-stream',
          authorization: `Bearer ${token}`,
        },
        validateStatus: () => true,
      },
    );

  it('lists what a user has approved: the app, the organization and the access', async () => {
    connA = await connect(alice, clientName('conn-a'), 'openid offline_access mcp:read');
    connB = await connect(alice, clientName('conn-b'), 'openid offline_access mcp:read mcp:write');

    const list = await mine(alice);
    expect(list.map((c) => c.client.name).sort()).toEqual([
      clientName('conn-a'),
      clientName('conn-b'),
    ]);
    const a = list.find((c) => c.client.id === connA.clientId)!;
    const b = list.find((c) => c.client.id === connB.clientId)!;
    idA = a.id;
    idB = b.id;
    expect(a.organization).toEqual({ id: acmeId, name: 'Acme' });
    expect(a.scopes).toContain('mcp:read');
    expect(a.scopes).not.toContain('mcp:write');
    expect(b.scopes).toEqual(expect.arrayContaining(['mcp:read', 'mcp:write']));
    expect(Date.parse(a.connected_at)).not.toBeNaN();
  });

  it('shows each user only their own connections', async () => {
    expect(await mine(owner)).toEqual([]);
    expect((await owner.del(`${API}/connections/${idA}`)).status).toBe(404); // not theirs to remove
    expect((await mine(alice)).length).toBe(2);
  });

  it('needs a login', async () => {
    expect((await new User('nobody', 'nobody@example.com').get(`${API}/connections`)).status).toBe(
      401,
    );
  });

  it('cuts off a disconnected app at once, and only that app', async () => {
    expect((await callMcp(connA.accessToken)).status).toBe(200);
    expect((await callMcp(connB.accessToken)).status).toBe(200);

    expect(status(await alice.del(`${API}/connections/${idA}`), 200)).toEqual({
      id: idA,
      deleted: true,
    });

    // The token is still signed and unexpired, but the approval behind it is gone.
    const cut = await callMcp(connA.accessToken);
    expect(cut.status).toBe(401);
    expect(cut.headers['www-authenticate']).toContain('invalid_token');
    expect(cut.data.code).toBe('CONNECTION_REVOKED');

    // It cannot get a new token either.
    const refresh = await alice.form('/auth/oauth2/token', {
      grant_type: 'refresh_token',
      refresh_token: connA.refreshToken,
      client_id: connA.clientId,
      resource: MCP_URL,
    });
    expect(refresh.status).toBeGreaterThanOrEqual(400);

    // The other connection is untouched.
    expect((await callMcp(connB.accessToken)).status).toBe(200);
    expect((await mine(alice)).map((c) => c.id)).toEqual([idB]);
    expect((await alice.del(`${API}/connections/${idA}`)).status).toBe(404); // already gone
  });

  it('asks for approval again when a disconnected app reconnects', async () => {
    const reconnect = await alice.get(
      `/auth/oauth2/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: connA.clientId,
        redirect_uri: 'http://localhost:9999/callback',
        scope: 'mcp:read',
        state: 's',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        code_challenge_method: 'S256',
        resource: MCP_URL,
      })}`,
    );
    expect(new URL(reconnect.data.url).pathname).toBe('/consent');
  });

  it('never revives an old write token after the same client is approved read-only', async () => {
    const old = await connect(
      alice,
      clientName('conn-generation'),
      'offline_access mcp:read mcp:write',
    );
    const connection = (await mine(alice)).find((c) => c.client.id === old.clientId)!;
    status(await alice.del(`${API}/connections/${connection.id}`), 200);
    expect((await callMcp(old.accessToken)).status).toBe(401);

    const current = await connect(alice, '', 'offline_access mcp:read', old.clientId);
    expect((await callMcp(old.accessToken)).status).toBe(401);
    expect((await callMcp(current.accessToken)).status).toBe(200);

    const refreshed = status(
      await alice.form('/auth/oauth2/token', {
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
        client_id: current.clientId,
        resource: MCP_URL,
      }),
      200,
    );
    expect((await callMcp(refreshed.access_token)).status).toBe(200);
    const session = await openSession(refreshed.access_token);
    try {
      expect(
        await session.call('create_record', {
          object: 'contact',
          properties: { first_name: 'Refused' },
        }),
      ).toMatchObject({ isError: true, data: { code: 'INSUFFICIENT_SCOPE' } });
    } finally {
      await session.close();
    }
  });

  it('honors a reduction in the current consent scopes', async () => {
    const old = await connect(alice, clientName('conn-reduce'), 'mcp:read mcp:write');
    const connection = (await mine(alice)).find((c) => c.client.id === old.clientId)!;
    status(
      await alice.post('/auth/oauth2/update-consent', {
        id: connection.id,
        update: { scopes: ['mcp:read'] },
      }),
      200,
    );
    expect((await callMcp(old.accessToken)).status).toBe(401);
  });
});

describe('audit of connections', () => {
  const events = (clientId: string) =>
    withDb(
      async (db) =>
        (
          await db.query(
            `SELECT event, "actorType", "actorId"::text AS actor, "organizationId"::text AS org, "targetType", "targetId"::text AS target, metadata
             FROM audit_event WHERE metadata->>'client_id' = $1 ORDER BY id`,
            [clientId],
          )
        ).rows as {
          event: string;
          actorType: string;
          actor: string;
          org: string;
          targetType: string | null;
          target: string | null;
          metadata: Record<string, any>;
        }[], // eslint-disable-line @typescript-eslint/no-explicit-any
    );
  const approved = 'openid offline_access mcp:read mcp:write';
  let conn: Connection;
  let connectionId = '';

  it('records who approved which application, for which organization, with what access', async () => {
    conn = await connect(alice, clientName('audit-a'), approved);

    const rows = await events(conn.clientId);
    expect(rows.map((r) => r.event)).toEqual(['mcp.connected']);
    expect(rows[0]).toMatchObject({ actorType: 'USER', actor: alice.id, org: acmeId });
    expect(rows[0].metadata).toEqual({ client_id: conn.clientId, scopes: approved.split(' ') });
    expect(JSON.stringify(rows[0].metadata)).not.toMatch(/sig|code_challenge|state/); // request plumbing stays out
  });

  it('records a refusal, and nothing is connected', async () => {
    const clientId = await deny(alice, clientName('audit-denied'), 'mcp:read mcp:delete');

    const rows = await events(clientId);
    expect(rows.map((r) => r.event)).toEqual(['mcp.connection_denied']);
    expect(rows[0]).toMatchObject({ actor: alice.id, org: acmeId });
    expect(rows[0].metadata.scopes).toEqual(['mcp:read', 'mcp:delete']);
    const listed = status(await alice.get(`${API}/connections`), 200).results as {
      client: { id: string };
    }[];
    expect(listed.some((c) => c.client.id === clientId)).toBe(false);
  });

  it('records a disconnect with the app that was cut off', async () => {
    const listed = status(await alice.get(`${API}/connections`), 200).results as {
      id: string;
      client: { id: string };
    }[];
    connectionId = listed.find((c) => c.client.id === conn.clientId)!.id;
    status(await alice.del(`${API}/connections/${connectionId}`), 200);

    const rows = await events(conn.clientId);
    expect(rows.map((r) => r.event)).toEqual(['mcp.connected', 'mcp.disconnected']);
    expect(rows[1]).toMatchObject({
      actorType: 'USER',
      actor: alice.id,
      org: acmeId,
      targetType: 'connection',
      target: connectionId,
    });
    expect(rows[1].metadata).toEqual({
      client_id: conn.clientId,
      client_name: clientName('audit-a'),
      scopes: approved.split(' '),
    });
  });

  it('records nothing for a disconnect that did not happen', async () => {
    expect((await alice.del(`${API}/connections/${connectionId}`)).status).toBe(404); // already gone
    expect((await owner.del(`${API}/connections/${connectionId}`)).status).toBe(404); // not theirs

    expect((await events(conn.clientId)).map((r) => r.event)).toEqual([
      'mcp.connected',
      'mcp.disconnected',
    ]);
  });
});

describe('losing access', () => {
  it('stops working for someone removed from the organization', async () => {
    const conn = await connect(alice, clientName('removed'), 'mcp:read');
    const session = await openSession(conn.accessToken);
    expect((await session.call('list_object_types')).isError).toBe(false);

    status(
      await owner.post('/auth/organization/remove-member', {
        memberIdOrEmail: alice.email,
        organizationId: acmeId,
      }),
      200,
    );

    const res = await axios.post(
      MCP_URL,
      { jsonrpc: '2.0', id: 9, method: 'tools/list' },
      {
        headers: {
          accept: 'application/json, text/event-stream',
          authorization: `Bearer ${conn.accessToken}`,
        },
        validateStatus: () => true,
      },
    );
    expect(res.status).toBe(403);
    expect(res.data.code).toBe('FORBIDDEN');
    await session.close().catch(() => undefined);
  });
});
