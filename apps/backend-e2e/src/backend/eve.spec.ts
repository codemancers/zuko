import axios from 'axios';
import { createHmac, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, User, verifyEmails } from '../support/crm-client';
import { BASE, MCP_URL, openSession } from '../support/mcp-client';

const run = Date.now().toString(36);
const suffix = `-${run}@eve.test`;
const slug = `eve-org-${run}`;
const user = new User('Eve harness owner', `owner${suffix}`);
const secret = process.env.EVE_AUTH_SECRET ?? '';
let organizationId = '';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

function delegationToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    iss: `${BASE}/eve`,
    aud: MCP_URL,
    sub: `user:${user.id}:organization:${organizationId}`,
    iat: now,
    exp: now + 60,
    jti: randomUUID(),
    zuko_user_id: user.id,
    zuko_organization_id: organizationId,
    scope: 'mcp:read mcp:write mcp:delete',
    ...overrides,
  });
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
}

function ok(reply: { status: number; data: any }, expected = 200) {
  if (reply.status !== expected) {
    throw new Error(`Expected ${expected} but got ${reply.status}: ${JSON.stringify(reply.data)}`);
  }
  return reply.data;
}

beforeAll(async () => {
  if (!secret) throw new Error('EVE_AUTH_SECRET is required for the Eve end-to-end test');
  ok(await user.signUp());
  await verifyEmails(suffix);
  organizationId = ok(
    await user.post('/auth/organization/create', { name: 'Eve Harness', slug }),
  ).id;
  ok(await user.post('/api/v1/objects', { slug: 'deal', label: 'Deal' }), 201);
}, 60_000);

afterAll(async () => cleanup(suffix, [slug]), 60_000);

describe('Eve harness authentication', () => {
  it('exchanges the browser session for a short-lived organization-bound route token', async () => {
    const body = ok(await user.post('/api/v1/eve/token'));
    const claims = JSON.parse(Buffer.from(body.access_token.split('.')[1], 'base64url').toString());

    expect(body.expires_at).toBeGreaterThan(Date.now());
    expect(claims).toMatchObject({
      iss: `${BASE}/eve`,
      aud: 'http://localhost:4200/eve',
      sub: `user:${user.id}:organization:${organizationId}`,
      zuko_user_id: user.id,
      zuko_organization_id: organizationId,
    });
  });

  it('uses a private delegation token to reach Zuko tools with the normal tenant context', async () => {
    const mcp = await openSession(delegationToken());
    try {
      const toolNames = (await mcp.tools()).map((tool) => tool.name);
      expect(toolNames).toContain('describe_object_type');

      const described = await mcp.call('describe_object_type', { object: 'deal' });
      expect(described.isError).toBe(false);
      expect(described.data).toMatchObject({ name: 'deal', label: 'Deal' });
    } finally {
      await mcp.close();
    }
  });

  it('rejects tampered delegation tokens', async () => {
    const token = delegationToken();
    const response = await axios.post(
      MCP_URL,
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      {
        headers: {
          accept: 'application/json, text/event-stream',
          authorization: `Bearer ${token.slice(0, -1)}x`,
        },
        validateStatus: () => true,
      },
    );
    expect(response.status).toBe(401);
  });
});
