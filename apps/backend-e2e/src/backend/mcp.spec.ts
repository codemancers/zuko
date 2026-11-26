import axios from 'axios';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, withDb } from '../support/crm-client';
import {
  BASE,
  MCP_URL,
  MCP_METADATA_URL,
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
const slugs = [`mcp-acme-${run}`, `mcp-beta-${run}`];
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');

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
  for (const user of [owner, alice]) {
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
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, slugs, `e2e-${run}-`);
}, 60_000);

describe('discovery', () => {
  it('has no backend MCP transport or protected-resource discovery', async () => {
    for (const path of [
      '/api/mcp',
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-protected-resource/api/mcp',
    ]) {
      expect((await axios.get(`${BASE}${path}`, { validateStatus: () => true })).status).toBe(404);
    }
    expect((await axios.post(`${BASE}/api/mcp`, {}, { validateStatus: () => true })).status).toBe(
      404,
    );
    const retired = await withDb(
      async (db) =>
        (
          await db.query('SELECT identifier FROM oauth_resource WHERE identifier=$1', [
            `${BASE}/api/mcp`,
          ])
        ).rows,
    );
    expect(retired).toEqual([]);
  });

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
      `resource_metadata="${new URL('/eve/v1/mcp/metadata', MCP_URL).href}"`,
    );
    expect(res.headers['www-authenticate']).toContain('records:read');
  });

  it('publishes the protected resource and its authorization server at the origin root', async () => {
    const resource = (await axios.get(MCP_METADATA_URL)).data;
    expect(resource.resource).toBe(MCP_URL);
    expect(resource.scopes_supported).toEqual(['records:read']);
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
    const res = await registerClient(clientName('register'), 'records:read');
    expect(res.status).toBe(201);
    expect(res.data.client_id).toBeTruthy();
    // The registered list is the most the client may ask for; what a connection actually
    // gets is decided at authorization (see 'what a connection may do').
    expect(res.data.scope).toContain('records:read');
  });

  it('accepts loopback clients that omit application_type', async () => {
    const res = await registerClient(clientName('inferred-native'), 'records:read', {
      application_type: undefined,
    });
    expect(res.status).toBe(201);
    expect(res.data.application_type).toBe('native');
  });

  it('refuses scopes that are not offered, and insecure redirects for web clients', async () => {
    expect(
      (await registerClient(clientName('bad-scope'), 'records:read admin:everything')).status,
    ).toBe(400);
    expect((await registerClient(clientName('legacy-scope'), 'mcp:read')).status).toBe(400);
    const web = await registerClient(clientName('web'), 'records:read', {
      application_type: 'web',
    });
    expect(web.status).toBe(400);
    expect(web.data.error).toBe('invalid_redirect_uri');
  });
});

describe('connecting', () => {
  let conn: Connection;

  it('issues a token for the user, bound to the organization active at the time', async () => {
    conn = await connect(
      alice,
      clientName('alice'),
      'openid offline_access records:read records:write',
    );
    expect(conn.scope.split(' ').sort()).toEqual(['records:read', 'records:write']);
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

describe('harness CRM tools', () => {
  it('discovers the CRM schema, directory and agent lifecycle tools', async () => {
    const mcp = await openSession(
      (await connect(owner, clientName('tools'), 'records:read schema:read directory:read'))
        .accessToken,
    );
    try {
      expect((await mcp.tools()).map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          'list_object_types',
          'describe_object_type',
          'list_members',
          'list_teams',
          'list_records',
          'filter_records',
          'get_record',
          'get_record_history',
          'list_linked_records',
          'get_record_activity',
          'list_comments',
          'add_comment',
          'update_comment',
          'delete_comment',
          'create_record',
          'update_record',
          'delete_record',
          'link_record',
          'unlink_record',
          'agent_start',
          'agent_get',
          'agent_update',
          'agent_cancel',
        ]),
      );
      expect(
        (await mcp.call('list_object_types')).data.results.map((o: { name: string }) => o.name),
      ).toEqual(['contact', 'company', 'deal', 'prospect', 'lead']);
      expect(
        (await mcp.call('describe_object_type', { object: 'deal' })).data.fields.map(
          (f: { name: string }) => f.name,
        ),
      ).toEqual(['name', 'amount', 'stage', 'expected_close_date', 'companies']);
      expect(
        (await mcp.call('list_members')).data.results.map((m: { email: string }) => m.email).sort(),
      ).toEqual([alice.email, owner.email]);
      expect((await mcp.call('list_teams')).data.results).toEqual([
        expect.objectContaining({ name: 'Acme' }),
      ]);
      expect((await mcp.call('describe_object_type', { object: 'deals' })).data.code).toBe(
        'NOT_FOUND',
      );
    } finally {
      await mcp.close();
    }
  });

  it('applies the member record scopes to reads, filters and history', async () => {
    const hidden = status(
      await owner.post(`${API}/objects/deal/records`, { properties: { name: 'Owner only' } }),
      201,
    ).id;
    const mine = status(
      await alice.post(`${API}/objects/deal/records`, {
        properties: { name: 'Alice deal', amount: 10 },
      }),
      201,
    ).id;
    const mcp = await openSession(
      (await connect(alice, clientName('member-tools'), 'records:read')).accessToken,
    );
    try {
      expect((await mcp.call('get_record', { object: 'deal', id: hidden })).data.code).toBe(
        'NOT_FOUND',
      );
      expect((await mcp.call('get_record', { object: 'deal', id: mine })).data.id).toBe(mine);
      const listed = (await mcp.call('list_records', { object: 'deal' })).data.results.map(
        (r: { id: string }) => r.id,
      );
      expect(listed).toContain(mine);
      expect(listed).not.toContain(hidden);
      const filtered = (
        await mcp.call('filter_records', {
          object: 'deal',
          filter_groups: [{ filters: [{ field_path: 'amount', operator: 'EQUALS', value: 10 }] }],
        })
      ).data.results;
      expect(filtered.map((r: { id: string }) => r.id)).toContain(mine);
      expect((await mcp.call('get_record_history', { object: 'deal', id: hidden })).isError).toBe(
        true,
      );
      expect(
        (await mcp.call('get_record_history', { object: 'deal', id: mine })).data.results,
      ).toHaveLength(1);
    } finally {
      await mcp.close();
    }
  });
});

describe('organization binding', () => {
  it('keeps a connection in the organization it was made for', async () => {
    const forAcme = await connect(owner, clientName('bound-acme'), 'records:read schema:read');
    expect(forAcme.claims['urn:zuko:org_id']).toBe(acmeId);
    const acmeRecord = status(
      await owner.post(`${API}/objects/deal/records`, { properties: { name: 'Acme only' } }),
      201,
    ).id;

    // The owner creates and switches to a second organization in the web app.
    betaId = status(
      await owner.post('/auth/organization/create', { name: 'Beta', slug: slugs[1] }),
      200,
    ).id;
    expect(status(await owner.get(`${API}/me`), 200).organization_id).toBe(betaId);
    const betaRecord = status(
      await owner.post(`${API}/objects/deal/records`, { properties: { name: 'Beta only' } }),
      201,
    ).id;

    const acme = await openSession(forAcme.accessToken);
    expect(
      (await acme.call('list_object_types')).data.results.map((o: { name: string }) => o.name),
    ).toEqual(['contact', 'company', 'deal', 'prospect', 'lead']);
    expect((await acme.call('get_record', { object: 'deal', id: acmeRecord })).data.id).toBe(
      acmeRecord,
    );
    expect((await acme.call('get_record', { object: 'deal', id: betaRecord })).data.code).toBe(
      'NOT_FOUND',
    );
    await acme.close();

    const forBeta = await connect(owner, clientName('bound-beta'), 'records:read schema:read');
    expect(forBeta.claims['urn:zuko:org_id']).toBe(betaId);
    const beta = await openSession(forBeta.accessToken);
    expect(
      (await beta.call('list_object_types')).data.results.map((o: { name: string }) => o.name),
    ).toEqual(['contact', 'company', 'deal', 'prospect', 'lead']);
    expect(
      (await beta.call('list_records', { object: 'deal' })).data.results.map(
        (record: { id: string }) => record.id,
      ),
    ).toEqual([betaRecord]);
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
  const callMcp = async (token: string) => {
    const session = await openSession(token);
    try {
      return await session.call('list_records', { object: 'deal' });
    } finally {
      await session.close();
    }
  };

  it('lists what a user has approved: the app, the organization and the access', async () => {
    connA = await connect(alice, clientName('conn-a'), 'openid offline_access records:read');
    connB = await connect(
      alice,
      clientName('conn-b'),
      'openid offline_access records:read records:write',
    );

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
    expect(a.scopes).toContain('records:read');
    expect(a.scopes).not.toContain('records:write');
    expect(b.scopes).toEqual(expect.arrayContaining(['records:read', 'records:write']));
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
    expect((await callMcp(connA.accessToken)).isError).toBe(false);
    expect((await callMcp(connB.accessToken)).isError).toBe(false);

    expect(status(await alice.del(`${API}/connections/${idA}`), 200)).toEqual({
      id: idA,
      deleted: true,
    });

    // The token is still signed and unexpired, but the approval behind it is gone.
    const cut = await callMcp(connA.accessToken);
    expect(cut.isError).toBe(true);

    // It cannot get a new token either.
    const refresh = await alice.form('/auth/oauth2/token', {
      grant_type: 'refresh_token',
      refresh_token: connA.refreshToken,
      client_id: connA.clientId,
      resource: MCP_URL,
    });
    expect(refresh.status).toBeGreaterThanOrEqual(400);

    // The other connection is untouched.
    expect((await callMcp(connB.accessToken)).isError).toBe(false);
    expect((await mine(alice)).map((c) => c.id)).toEqual([idB]);
    expect((await alice.del(`${API}/connections/${idA}`)).status).toBe(404); // already gone
  });

  it('asks for approval again when a disconnected app reconnects', async () => {
    const reconnect = await alice.get(
      `/auth/oauth2/authorize?${new URLSearchParams({
        response_type: 'code',
        client_id: connA.clientId,
        redirect_uri: 'http://localhost:9999/callback',
        scope: 'records:read',
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
      'offline_access records:read records:write',
    );
    const connection = (await mine(alice)).find((c) => c.client.id === old.clientId)!;
    status(await alice.del(`${API}/connections/${connection.id}`), 200);
    expect((await callMcp(old.accessToken)).isError).toBe(true);

    const current = await connect(alice, '', 'offline_access records:read', old.clientId);
    expect((await callMcp(old.accessToken)).isError).toBe(true);
    expect((await callMcp(current.accessToken)).isError).toBe(false);

    const refreshed = status(
      await alice.form('/auth/oauth2/token', {
        grant_type: 'refresh_token',
        refresh_token: current.refreshToken,
        client_id: current.clientId,
        resource: MCP_URL,
      }),
      200,
    );
    expect((await callMcp(refreshed.access_token)).isError).toBe(false);
    const session = await openSession(refreshed.access_token);
    try {
      await expect(
        session.client.callTool({
          name: 'create_record',
          arguments: { object: 'contact', properties: { first_name: 'Refused' } },
        }),
      ).rejects.toThrow(/403|scope/i);
    } finally {
      await session.close();
    }
  });

  it('keeps an old broad grant invalid when a second narrower grant is issued', async () => {
    const old = await connect(
      alice,
      clientName('conn-narrow'),
      'offline_access records:read records:write',
    );
    const consentId = old.claims['urn:zuko:consent_id'];
    status(
      await alice.post('/auth/oauth2/update-consent', {
        id: consentId,
        update: { scopes: ['records:read'] },
      }),
      200,
    );
    const narrow = status(
      await alice.form('/auth/oauth2/token', {
        grant_type: 'refresh_token',
        refresh_token: old.refreshToken,
        client_id: old.clientId,
        scope: 'records:read',
        resource: MCP_URL,
      }),
      200,
    );
    const claims = JSON.parse(
      Buffer.from(narrow.access_token.split('.')[1], 'base64url').toString(),
    );
    expect(claims['urn:zuko:harness_grant']).not.toBe(old.claims['urn:zuko:harness_grant']);
    expect(claims['urn:zuko:consent_id']).toBe(consentId);
    expect((await callMcp(old.accessToken)).isError).toBe(true);
    expect((await callMcp(narrow.access_token)).isError).toBe(false);
  });

  it('honors a reduction in the current consent scopes', async () => {
    const old = await connect(alice, clientName('conn-reduce'), 'records:read records:write');
    const connection = (await mine(alice)).find((c) => c.client.id === old.clientId)!;
    status(
      await alice.post('/auth/oauth2/update-consent', {
        id: connection.id,
        update: { scopes: ['records:read'] },
      }),
      200,
    );
    expect((await callMcp(old.accessToken)).isError).toBe(true);
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
  const approved = 'openid offline_access records:read records:write';
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
    const clientId = await deny(alice, clientName('audit-denied'), 'records:read records:delete');

    const rows = await events(clientId);
    expect(rows.map((r) => r.event)).toEqual(['mcp.connection_denied']);
    expect(rows[0]).toMatchObject({ actor: alice.id, org: acmeId });
    expect(rows[0].metadata.scopes).toEqual(['records:read', 'records:delete']);
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
    const conn = await connect(alice, clientName('removed'), 'records:read');
    const session = await openSession(conn.accessToken);
    expect((await session.call('list_records', { object: 'deal' })).isError).toBe(false);

    status(
      await owner.post('/auth/organization/remove-member', {
        memberIdOrEmail: alice.email,
        organizationId: acmeId,
      }),
      200,
    );

    // The signed JWT is still valid locally; the CRM backend checks membership.
    expect((await session.call('list_records', { object: 'deal' })).isError).toBe(true);
    await session.close().catch(() => undefined);
  });
});
