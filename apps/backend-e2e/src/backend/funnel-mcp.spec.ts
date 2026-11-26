import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails } from '../support/crm-client';
import { connect, openSession } from '../support/mcp-client';

/**
 * The prospect -> lead -> contact funnel, worked through the harness MCP the way an agent does
 * it: only the generic CRM tools, no conversion operation. The order is what makes a conversion
 * safe to repeat: find, create, link, and mark the source converted last.
 *
 *   Acme: owner, alice (member)
 */
const run = Date.now().toString(36);
const suffix = `-${run}@funnel.test`;
const slug = `funnel-${run}`;
const mk = (name: string) => new User(name, `${name}${suffix}`);
const owner = mk('owner');
const alice = mk('alice');
const SCOPES = 'records:read records:write records:delete schema:read';

type Tool = (name: string, args?: Record<string, unknown>) => Promise<{ isError: boolean; data: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any

function ok(reply: { status: number; data?: unknown }) {
  if (reply.status !== 200) throw new Error(`${reply.status}: ${JSON.stringify(reply.data)}`);
  return reply.data as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
const created = async (call: Tool, object: string, properties: Record<string, unknown>) => {
  const reply = await call('create_record', { object, properties });
  if (reply.isError) throw new Error(`create ${object}: ${JSON.stringify(reply.data)}`);
  return reply.data.id as string;
};
const linkedIds = async (call: Tool, object: string, id: string, link: string) =>
  (await call('list_linked_records', { object, id, link })).data.results.map(
    (r: { id: string }) => r.id,
  );

beforeAll(async () => {
  for (const user of [owner, alice]) ok(await user.signUp());
  await verifyEmails(suffix);
  const org = ok(await owner.post('/auth/organization/create', { name: 'Funnel', slug })).id;
  const invite = ok(
    await owner.post('/auth/organization/invite-member', {
      email: alice.email,
      role: 'member',
      organizationId: org,
    }),
  );
  ok(await alice.post('/auth/organization/accept-invitation', { invitationId: invite.id }));
  ok(await alice.signIn());
}, 120_000);

afterAll(async () => {
  await cleanup(suffix, [slug], `e2e-funnel-${run}-`);
}, 60_000);

describe('the funnel skills through MCP', () => {
  it('publishes the conversion skills, and every tool and link they name exists', async () => {
    const mcp = await openSession((await connect(owner, `e2e-funnel-${run}-skills`, SCOPES)).accessToken);
    try {
      const resources = (await mcp.client.listResources()).resources;
      const uris = resources.map((r) => r.uri);
      expect(uris).toEqual(expect.arrayContaining(['skill://convert-prospect/SKILL.md', 'skill://convert-lead/SKILL.md']));

      const tools = new Set((await mcp.tools()).map((t) => t.name));
      const links = new Set<string>();
      for (const object of ['prospect', 'lead', 'contact', 'company', 'deal']) {
        const described = (await mcp.call('describe_object_type', { object })).data;
        for (const a of described.associations) links.add(a.name);
      }
      for (const uri of ['skill://convert-prospect/SKILL.md', 'skill://convert-lead/SKILL.md']) {
        const read = await mcp.client.readResource({ uri });
        const text = (read.contents[0] as { text: string }).text;
        expect(text).toMatch(/^---\nname: convert-/);
        // Every `identifier` the skill puts in code ticks that looks like a tool or a link must be real.
        const named = [...text.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1]);
        const toolNames = named.filter((n) => /_(record|records|object_type)$/.test(n));
        const linkNames = named.filter((n) => /^(prospect|lead|contact|deal)_(lead|company|contact|deal)$/.test(n));
        expect(toolNames.length).toBeGreaterThan(3);
        expect(linkNames.length).toBeGreaterThan(2);
        for (const name of toolNames) expect(tools.has(name), `tool ${name}`).toBe(true);
        for (const name of linkNames) expect(links.has(name), `link ${name}`).toBe(true);
      }
    } finally {
      await mcp.close();
    }
  });
});

describe('the funnel through MCP', () => {
  it('lets an agent discover the funnel objects and how they link', async () => {
    const mcp = await openSession((await connect(owner, `e2e-funnel-${run}-discover`, SCOPES)).accessToken);
    try {
      const names = (await mcp.call('list_object_types')).data.results.map(
        (o: { name: string }) => o.name,
      );
      expect(names).toEqual(expect.arrayContaining(['prospect', 'lead', 'contact', 'company']));
      const prospect = (await mcp.call('describe_object_type', { object: 'prospect' })).data;
      expect(prospect.fields.map((f: { name: string }) => f.name)).toEqual(
        expect.arrayContaining(['email', 'status', 'converted_lead', 'companies']),
      );
      expect(
        prospect.fields.find((f: { name: string }) => f.name === 'converted_lead').config,
      ).toMatchObject({ link: 'prospect_lead', target: 'lead', many: false });
      // A link is not a property: the write is refused, and says where links go.
      const bad = await mcp.call('create_record', {
        object: 'prospect',
        properties: { first_name: 'Nope', companies: ['1'] },
      });
      expect(bad.isError).toBe(true);
      expect(JSON.stringify(bad.data)).toContain('associations API');
    } finally {
      await mcp.close();
    }
  });

  it('converts a prospect to a lead and the lead to a contact, and survives a repeat', async () => {
    const mcp = await openSession((await connect(owner, `e2e-funnel-${run}-flow`, SCOPES)).accessToken);
    const call = mcp.call as Tool;
    try {
      const email = `pia${suffix}`;
      const company = await created(call, 'company', { name: `Pia Co ${run}`, status: 'prospect' });
      const prospect = await created(call, 'prospect', {
        first_name: 'Pia',
        last_name: 'Prospect',
        email,
        job_title: 'CTO',
        status: 'engaged',
      });
      expect((await call('link_record', { object: 'prospect', id: prospect, link: 'prospect_company', record_id: company })).isError).toBe(false);

      // Prospect -> lead. Nothing holds this email in leads yet.
      const found = await call('filter_records', {
        object: 'lead',
        filter_groups: [{ filters: [{ field_path: 'email', operator: 'EQUALS', value: email }] }],
      });
      expect(found.data.results).toEqual([]);
      const lead = await created(call, 'lead', {
        first_name: 'Pia',
        last_name: 'Prospect',
        email,
        job_title: 'CTO',
        status: 'new',
        source: 'prospect',
      });
      await call('link_record', { object: 'lead', id: lead, link: 'lead_company', record_id: company });
      await call('link_record', { object: 'prospect', id: prospect, link: 'prospect_lead', record_id: lead });
      expect((await call('update_record', { object: 'prospect', id: prospect, properties: { status: 'converted' } })).isError).toBe(false);

      expect(await linkedIds(call, 'prospect', prospect, 'prospect_lead')).toEqual([lead]);
      expect(await linkedIds(call, 'lead', lead, 'lead_company')).toEqual([company]);

      // A repeat (a retry after a lost reply): creating again is refused and names the lead to use.
      const again = await call('create_record', {
        object: 'lead',
        properties: { first_name: 'Pia', email: email.toUpperCase() },
      });
      expect(again.isError).toBe(true);
      expect(again.data.errors[0]).toMatchObject({
        field: 'email',
        code: 'DUPLICATE_VALUE',
        existing_id: lead,
      });
      // Linking it again changes nothing.
      await call('link_record', { object: 'prospect', id: prospect, link: 'prospect_lead', record_id: lead });
      expect(await linkedIds(call, 'prospect', prospect, 'prospect_lead')).toEqual([lead]);

      // Lead -> contact, the same way.
      const contact = await created(call, 'contact', {
        first_name: 'Pia',
        last_name: 'Prospect',
        email,
        job_title: 'CTO',
        lifecycle_stage: 'qualified',
      });
      await call('link_record', { object: 'contact', id: contact, link: 'contact_company', record_id: company });
      await call('link_record', { object: 'lead', id: lead, link: 'lead_contact', record_id: contact });
      await call('update_record', { object: 'lead', id: lead, properties: { status: 'converted' } });
      expect(await linkedIds(call, 'lead', lead, 'lead_contact')).toEqual([contact]);
      expect((await call('get_record', { object: 'lead', id: lead })).data.properties.status).toBe('converted');
      // The company is shared, and the company's own status is just a field.
      await call('update_record', { object: 'company', id: company, properties: { status: 'active' } });
      expect(await linkedIds(call, 'company', company, 'prospect_company')).toEqual([prospect]);
      expect(await linkedIds(call, 'company', company, 'lead_company')).toEqual([lead]);
      expect(await linkedIds(call, 'company', company, 'contact_company')).toEqual([contact]);
    } finally {
      await mcp.close();
    }
  }, 30_000); // about thirty sequential tool calls: slower when other specs share the server

  it('does not tell a member which record holds a value they cannot read', async () => {
    const email = `hidden${suffix}`;
    const ownerMcp = await openSession((await connect(owner, `e2e-funnel-${run}-own`, SCOPES)).accessToken);
    const aliceMcp = await openSession((await connect(alice, `e2e-funnel-${run}-member`, SCOPES)).accessToken);
    try {
      const hidden = await created(ownerMcp.call as Tool, 'lead', { first_name: 'Hidden', email });
      const attempt = await aliceMcp.call('create_record', {
        object: 'lead',
        properties: { first_name: 'Copy', email },
      });
      expect(attempt.isError).toBe(true);
      expect(attempt.data.errors[0]).toMatchObject({ field: 'email', code: 'DUPLICATE_VALUE' });
      expect(attempt.data.errors[0]).not.toHaveProperty('existing_id');
      expect((await aliceMcp.call('get_record', { object: 'lead', id: hidden })).data.code).toBe('NOT_FOUND');
    } finally {
      await ownerMcp.close();
      await aliceMcp.close();
    }
  });
});
