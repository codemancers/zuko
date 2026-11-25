import axios from 'axios';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, User, verifyEmails, withDb } from '../support/crm-client';
import { BASE, connect, MCP_URL, openSession } from '../support/mcp-client';

const run = `${Date.now().toString(36)}-${process.pid}`;
const suffix = `-${run}@eve.test`;
const slug = `eve-org-${run}`;
const user = new User('Eve harness owner', `owner${suffix}`);
const resource = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/eve/v1/mcp`;
const serviceHeaders = { 'x-zuko-harness-key': process.env.EVE_AUTH_SECRET ?? '' };
let organizationId = '';
const clients: string[] = [];
const ok = (reply: { status: number; data: any }, expected = 200) => {
  if (reply.status !== expected)
    throw new Error(`Expected ${expected}, got ${reply.status}: ${JSON.stringify(reply.data)}`);
  return reply.data;
};
const post = (path: string, data: unknown, headers = {}) =>
  axios.post(`${BASE}/api/v1/harness/${path}`, data, {
    headers: { ...serviceHeaders, ...headers },
    validateStatus: () => true,
  });
const tokenGrant = (token: string) => {
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  expect(claims['urn:zuko:harness_grant']).toEqual(expect.any(String));
  return {
    reference: claims['urn:zuko:harness_grant'],
    organization_id: claims['urn:zuko:org_id'],
  };
};
const delegate = async (grant: { reference: string; organization_id: string }) =>
  ok(await post('delegate', grant));
const api = (path: string, token: string, method = 'GET', data?: unknown) =>
  axios.request({
    url: `${BASE}/api/v1/${path}`,
    method,
    data,
    headers: { authorization: `Bearer ${token}` },
    validateStatus: () => true,
  });

beforeAll(async () => {
  ok(await user.signUp());
  await verifyEmails(suffix);
  organizationId = ok(
    await user.post('/auth/organization/create', { name: 'Eve Harness', slug }),
  ).id;
}, 60_000);

afterAll(async () => {
  await cleanup(suffix, [slug]);
  await withDb((db) => db.query('DELETE FROM oauth_client WHERE "clientId" = ANY($1)', [clients]));
}, 60_000);

describe('backend-issued harness delegation', () => {
  it('issues asymmetric route tokens and delegates only to the CRM audience', async () => {
    const route = ok(await user.post('/api/v1/eve/token'));
    const claims = JSON.parse(
      Buffer.from(route.access_token.split('.')[1], 'base64url').toString(),
    );
    const header = JSON.parse(
      Buffer.from(route.access_token.split('.')[0], 'base64url').toString(),
    );
    expect(header.alg).not.toBe('HS256');
    expect(claims).toMatchObject({
      iss: `${BASE}/auth`,
      aud: resource.replace('/v1/mcp', ''),
      sub: user.id,
      'urn:zuko:org_id': organizationId,
    });
    expect((await api('objects', route.access_token)).status).toBe(401);
    const grant = tokenGrant(route.access_token);
    const delegated = await delegate(grant);
    expect(ok(await api('objects', delegated.access_token)).results.length).toBeGreaterThan(0);
    expect(
      (await post('authorize', {}, { authorization: `Bearer ${delegated.access_token}` })).status,
    ).toBe(404);
    expect(
      (await axios.post(`${BASE}/api/v1/harness/delegate`, grant, { validateStatus: () => true }))
        .status,
    ).toBe(401);
    expect(
      (
        await post('delegate', {
          ...grant,
          organization_id: String(BigInt(organizationId) + 10000n),
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await axios.post(
          MCP_URL,
          {},
          {
            headers: { authorization: `Bearer ${delegated.access_token}` },
            validateStatus: () => true,
          },
        )
      ).status,
    ).toBe(401);
  });

  it('binds OAuth scopes to the delegation and revokes already issued tokens immediately', async () => {
    const connection = await connect(user, `Harness read ${run}`, 'records:read');
    clients.push(connection.clientId);
    const grant = tokenGrant(connection.accessToken);
    const delegated = await delegate(grant);
    expect((await api('objects/deal/records', delegated.access_token)).status).toBe(200);
    expect(
      (
        await api('objects/contact/records', delegated.access_token, 'POST', {
          properties: { first_name: 'Forbidden' },
        })
      ).status,
    ).toBe(403);
    expect(
      (await api('objects', delegated.access_token, 'POST', { name: 'forbidden' })).status,
    ).toBe(401);
    const consentId = connection.claims['urn:zuko:consent_id'];
    ok(await user.del(`/api/v1/connections/${consentId}`));
    expect((await post('delegate', grant)).status).toBe(401);
    expect((await api('objects/deal/records', delegated.access_token)).status).toBe(401);
    // The JWT still passes local verification; the backend refuses its revoked grant.
    const mcp = await openSession(connection.accessToken);
    try {
      const result = await mcp.call('list_records', { object: 'deal' });
      expect(result.isError).toBe(true);
    } finally {
      await mcp.close();
    }
  });

  it('rechecks live membership and organization readiness', async () => {
    const route = ok(await user.post('/api/v1/eve/token'));
    const grant = tokenGrant(route.access_token);
    await withDb((db) =>
      db.query('UPDATE organization_setup SET status=$1 WHERE "organizationId"=$2', [
        'running',
        organizationId,
      ]),
    );
    try {
      expect((await post('delegate', grant)).status).toBe(409);
    } finally {
      await withDb((db) =>
        db.query('UPDATE organization_setup SET status=$1 WHERE "organizationId"=$2', [
          'ready',
          organizationId,
        ]),
      );
    }
    const member = await withDb(
      async (db) =>
        (
          await db.query(
            'DELETE FROM member WHERE "userId"=$1 AND "organizationId"=$2 RETURNING *',
            [user.id, organizationId],
          )
        ).rows[0],
    );
    try {
      expect((await post('delegate', grant)).status).toBe(403);
    } finally {
      await withDb((db) =>
        db.query(
          'INSERT INTO member (id,"userId","organizationId",role,"createdAt") VALUES ($1,$2,$3,$4,$5)',
          [member.id, user.id, organizationId, member.role, member.createdAt],
        ),
      );
    }
  });
});

describe('grant lifetime', () => {
  it('rejects expired grants, tampered tokens, and a signed-out browser session', async () => {
    const route = ok(await user.post('/api/v1/eve/token'));
    const grant = tokenGrant(route.access_token);
    const delegated = await delegate(grant);
    expect((await api('objects', delegated.access_token + 'x')).status).toBe(401);
    await withDb((db) =>
      db.query('UPDATE harness_grant SET "expiresAt"=$1 WHERE reference=$2', [
        new Date(0),
        grant.reference,
      ]),
    );
    expect((await post('delegate', grant)).status).toBe(401);
    const renewed = ok(await user.post('/api/v1/eve/token'));
    const live = tokenGrant(renewed.access_token);
    ok(await user.post('/auth/sign-out'));
    expect((await post('delegate', live)).status).toBe(401);
    ok(await user.signIn());
  });
});

describe('public harness MCP', () => {
  it('publishes discovery without requiring a web session', async () => {
    const metadata = await axios.get(
      resource.replace('/eve/v1/mcp', '/.well-known/oauth-protected-resource/eve/v1/mcp'),
      { validateStatus: () => true },
    );
    expect(metadata.status).toBe(200);
    expect(metadata.data.resource).toBe(resource);
    expect(metadata.data.authorization_servers).toContain(`${BASE}/auth`);
  });

  it('exposes CRM and agent tools, reads through REST, and enforces invocation scope', async () => {
    const connection = await connect(user, `Harness public ${run}`, 'schema:read');
    clients.push(connection.clientId);
    const mcp = await openSession(connection.accessToken);
    try {
      const names = (await mcp.tools()).map((tool) => tool.name);
      expect(names).toEqual(
        expect.arrayContaining([
          'list_object_types',
          'describe_object_type',
          'create_record',
          'agent_start',
          'agent_get',
          'agent_update',
          'agent_cancel',
        ]),
      );
      const schema = await mcp.call('describe_object_type', { object: 'deal' });
      expect(schema.isError).toBe(false);
      expect(schema.data).toMatchObject({ name: 'deal' });
      await expect(
        mcp.client.callTool({ name: 'agent_start', arguments: { message: 'Hello' } }),
      ).rejects.toThrow(/403|forbidden|scope/i);
    } finally {
      await mcp.close();
    }
  });
  it('owns invocations per grant and allows authorized direct mutations', async () => {
    const connection = await connect(
      user,
      `Harness agent ${run}`,
      'records:read records:write agent:invoke',
    );
    const other = await connect(user, `Harness other ${run}`, 'records:read agent:invoke');
    clients.push(connection.clientId, other.clientId);
    const mcp = await openSession(connection.accessToken);
    const stranger = await openSession(other.accessToken);
    try {
      const write = await mcp.client.callTool({
        name: 'create_record',
        arguments: { object: 'contact', properties: { first_name: `MCP direct ${run}` } },
      });
      expect(write.isError).not.toBe(true);
      expect(write.structuredContent).toMatchObject({ object: 'contact' });
      const started = await mcp.client.callTool({
        name: 'agent_start',
        arguments: { message: 'Say hello without using CRM tools.' },
      });
      expect(started.isError).not.toBe(true);
      const invocation = started.structuredContent as { invocationId: string };
      expect(invocation.invocationId).toBeTruthy();
      const read = await mcp.client.callTool({
        name: 'agent_get',
        arguments: { invocationId: invocation.invocationId },
      });
      expect(read.isError).not.toBe(true);
      for (const name of ['agent_get', 'agent_cancel']) {
        const denied = await stranger.client.callTool({
          name,
          arguments: { invocationId: invocation.invocationId },
        });
        expect(denied.isError).toBe(true);
        expect(denied.structuredContent).toMatchObject({ error: { code: 'not_found' } });
      }
      const cancelled = await mcp.client.callTool({
        name: 'agent_cancel',
        arguments: { invocationId: invocation.invocationId },
      });
      expect(cancelled.isError).not.toBe(true);
    } finally {
      await mcp.close();
      await stranger.close();
    }
  });
});

describe('independent resource scopes', () => {
  const cases = [
    {
      scope: 'records:read',
      allowed: 'list_records',
      arguments: { object: 'deal' },
      path: 'objects/deal/records',
      denied: [
        ['describe_object_type', 'schema:read', 'objects/deal'],
        ['list_members', 'directory:read', 'members'],
      ],
    },
    {
      scope: 'schema:read',
      allowed: 'describe_object_type',
      arguments: { object: 'deal' },
      path: 'objects/deal',
      denied: [
        ['list_records', 'records:read', 'objects/deal/records'],
        ['list_teams', 'directory:read', 'teams'],
      ],
    },
    {
      scope: 'directory:read',
      allowed: 'list_members',
      arguments: {},
      path: 'members',
      denied: [
        ['describe_object_type', 'schema:read', 'objects/deal'],
        ['list_records', 'records:read', 'objects/deal/records'],
      ],
    },
  ];
  it.each(cases)(
    '$scope only grants access to its own tools and REST resource',
    async ({ scope, allowed, arguments: args, path, denied }) => {
      const connection = await connect(user, `Isolated ${scope} ${run}`, scope);
      clients.push(connection.clientId);
      const grant = tokenGrant(connection.accessToken);
      const delegated = await delegate(grant);
      const mcp = await openSession(connection.accessToken);
      try {
        expect((await mcp.call(allowed, args)).isError).toBe(false);
        expect((await api(path, delegated.access_token)).status).toBe(200);
        for (const [tool, required, apiPath] of denied) {
          const response = await axios.post(
            resource,
            {
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: { name: tool, arguments: { object: 'deal' } },
            },
            {
              headers: {
                accept: 'application/json, text/event-stream',
                authorization: `Bearer ${connection.accessToken}`,
              },
              validateStatus: () => true,
            },
          );
          expect(response.status).toBe(403);
          expect(response.headers['www-authenticate']).toContain(`scope="${required}"`);
          expect((await api(apiPath, delegated.access_token)).status).toBe(403);
        }
      } finally {
        await mcp.close();
      }
    },
  );

  it('allows an agent-only connection without granting CRM reads', async () => {
    const connection = await connect(user, `Agent only ${run}`, 'agent:invoke');
    clients.push(connection.clientId);
    const grant = tokenGrant(connection.accessToken);
    const delegated = await delegate(grant);
    expect((await api('objects/deal/records', delegated.access_token)).status).toBe(403);
    const mcp = await openSession(connection.accessToken);
    try {
      const result = await mcp.client.callTool({
        name: 'agent_get',
        arguments: { invocationId: 'missing-invocation' },
      });
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({ error: { code: 'not_found' } });
    } finally {
      await mcp.close();
    }
  });
});

describe('harness protocol hardening', () => {
  it('rejects legacy batches and oversized bodies before agent dispatch', async () => {
    const connection = await connect(user, `Batch scope ${run}`, 'records:read');
    clients.push(connection.clientId);
    for (const name of ['agent_start', 'agent_get', 'agent_update', 'agent_cancel']) {
      const response = await axios.post(
        MCP_URL,
        [{ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: {} } }],
        {
          headers: {
            authorization: `Bearer ${connection.accessToken}`,
            accept: 'application/json, text/event-stream',
            'mcp-protocol-version': '2025-03-26',
          },
          validateStatus: () => true,
        },
      );
      expect(response.status).toBe(403);
      expect(response.data.code).toBe('invalid_request');
    }
    const response = await axios.post(MCP_URL, ' '.repeat(1024 * 1024 + 1), {
      headers: {
        authorization: `Bearer ${connection.accessToken}`,
        'content-type': 'application/json',
      },
      validateStatus: () => true,
    });
    expect(response.status).toBe(403);
    expect(response.data.code).toBe('request_too_large');
  });

  it('fails closed for tool names without an explicit OAuth scope', async () => {
    const connection = await connect(user, `Unmapped tool ${run}`, 'records:read');
    clients.push(connection.clientId);
    for (const name of ['unmapped_tool', 'constructor', '__proto__']) {
      const response = await axios.post(
        MCP_URL,
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: {} },
        },
        {
          headers: {
            authorization: `Bearer ${connection.accessToken}`,
            accept: 'application/json, text/event-stream',
          },
          validateStatus: () => true,
        },
      );
      expect(response.status).toBe(403);
      expect(response.data.code).toBe('unscoped_tool');
    }
  });

  it('does not let a revoked but unexpired agent token start paid work', async () => {
    const connection = await connect(user, `Revoked agent ${run}`, 'agent:invoke');
    clients.push(connection.clientId);
    expect(Number(connection.claims.exp) - Number(connection.claims.iat)).toBe(300);
    ok(await user.del(`/api/v1/connections/${connection.claims['urn:zuko:consent_id']}`));
    const session = await openSession(connection.accessToken);
    try {
      await expect(
        session.client.callTool({ name: 'agent_start', arguments: { message: 'Must not start' } }),
      ).rejects.toThrow(/403|forbidden/i);
      expect((await session.tools()).length).toBeGreaterThan(0);
    } finally {
      await session.close();
    }
  });
});
