import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails, withDb } from '../support/crm-client';
import { connect, openSession } from '../support/mcp-client';

// Opt-in: uses the hosting user's ChatGPT subscription and real model service.
describe.skipIf(
  process.env.RUN_LIVE_MODEL_TEST !== '1' || process.env.EVE_USE_CODEX_SUBSCRIPTION !== 'true',
)('live subscription agent', () => {
  const run = `${Date.now().toString(36)}-${process.pid}`;
  const suffix = `-${run}@model-smoke.test`;
  const slug = `model-smoke-${run}`;
  const uniqueObject = `smoke_${run.replaceAll('-', '_')}`;
  const user = new User('Model smoke owner', `owner${suffix}`);
  let clientId = '';
  beforeAll(async () => {
    const signup = await user.signUp();
    if (signup.status !== 200) throw new Error(`Signup failed: ${JSON.stringify(signup.data)}`);
    await verifyEmails(suffix);
    const organization = await user.post('/auth/organization/create', {
      name: 'Model smoke',
      slug,
    });
    if (organization.status !== 200)
      throw new Error(`Organization failed: ${JSON.stringify(organization.data)}`);
    const until = Date.now() + 30_000;
    while ((await user.get('/api/v1/me')).status !== 200) {
      if (Date.now() > until) throw new Error('Organization not ready');
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    const custom = await user.post('/api/v1/objects', {
      slug: uniqueObject,
      label: uniqueObject,
      plural_label: `${uniqueObject}s`,
    });
    if (custom.status !== 201)
      throw new Error(`Schema fixture failed: ${JSON.stringify(custom.data)}`);
  }, 60_000);
  afterAll(async () => {
    await cleanup(suffix, [slug]);
    if (clientId)
      await withDb((db) => db.query('DELETE FROM oauth_client WHERE "clientId"=$1', [clientId]));
  }, 60_000);

  it('runs a real model turn and reads organization schemas through CRM tools', async () => {
    const connection = await connect(user, `Live model ${run}`, 'schema:read agent:invoke');
    clientId = connection.clientId;
    const session = await openSession(connection.accessToken);
    let invocationId = '';
    let terminal = false;
    try {
      const started = await session.client.callTool({
        name: 'agent_start',
        arguments: {
          message:
            'Call list_object_types once, then reply with the object type names you found. Do not create, update, delete, or link any data.',
        },
      });
      expect(started.isError).not.toBe(true);
      let state = started.structuredContent as {
        invocationId: string;
        status: string;
        pollAfterMs?: number;
        result?: unknown;
        error?: unknown;
      };
      invocationId = state.invocationId;
      expect(invocationId).toBeTruthy();
      const until = Date.now() + 180_000;
      while (!['completed', 'failed', 'cancelled'].includes(state.status)) {
        if (Date.now() > until) throw new Error('Model smoke test timed out');
        if (state.status === 'input_required')
          throw new Error('Unexpected interaction for a read-only task');
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(state.pollAfterMs ?? 1000, 1000)),
        );
        const reply = await session.client.callTool({
          name: 'agent_get',
          arguments: { invocationId },
        });
        expect(reply.isError).not.toBe(true);
        state = reply.structuredContent as typeof state;
      }
      terminal = true;
      if (state.status !== 'completed') throw new Error(JSON.stringify(state.error ?? state));
      const result = JSON.stringify(state.result).toLowerCase();
      for (const name of ['contact', 'company', 'deal', uniqueObject])
        expect(result).toContain(name);
    } finally {
      if (invocationId && !terminal) {
        await session.client.callTool({ name: 'agent_cancel', arguments: { invocationId } });
        for (let i = 0; i < 30; i++) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const reply = await session.client.callTool({
            name: 'agent_get',
            arguments: { invocationId },
          });
          const state = reply.structuredContent as { status: string; pollAfterMs?: number };
          if (['completed', 'failed', 'cancelled'].includes(state.status)) break;
          const extraDelay = (state.pollAfterMs ?? 1000) - 1000;
          if (extraDelay > 0) await new Promise((resolve) => setTimeout(resolve, extraDelay));
        }
      }
      await session.close();
    }
  }, 240_000);
});
