import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User, cleanup, verifyEmails } from '../support/crm-client';
import { connect, openSession } from '../support/mcp-client';

/**
 * Campaigns worked through the harness MCP the way an agent does it: only the generic CRM tools.
 * Create a prospect and put it in a campaign, enrol and remove several at once, and what a
 * member who sees only their own records can and cannot do.
 *
 *   Acme: owner, alice (member)
 */
const run = Date.now().toString(36);
const suffix = `-${run}@campaigns.test`;
const slug = `campaigns-${run}`;
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
const members = async (call: Tool, campaign: string, link: string) => {
  const reply = await call('list_linked_records', { object: 'campaign', id: campaign, link, page_size: 100 });
  if (reply.isError) throw new Error(`list ${link}: ${JSON.stringify(reply.data)}`);
  return reply.data.results.map((r: { id: string }) => r.id) as string[];
};
const sorted = (list: string[]) => [...list].sort();

beforeAll(async () => {
  for (const user of [owner, alice]) ok(await user.signUp());
  await verifyEmails(suffix);
  const org = ok(await owner.post('/auth/organization/create', { name: 'Campaigns', slug })).id;
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
  await cleanup(suffix, [slug], `e2e-campaigns-${run}-`);
}, 60_000);

describe('campaigns through MCP', () => {
  it('lets an agent discover campaigns and the links that reach them', async () => {
    const mcp = await openSession((await connect(owner, `e2e-campaigns-${run}-discover`, SCOPES)).accessToken);
    try {
      const names = (await mcp.call('list_object_types')).data.results.map((o: { name: string }) => o.name);
      expect(names).toContain('campaign');
      const campaign = (await mcp.call('describe_object_type', { object: 'campaign' })).data;
      expect(campaign.fields.map((f: { name: string }) => f.name)).toEqual(
        expect.arrayContaining(['name', 'status', 'type', 'budget', 'assets']),
      );
      expect(campaign.associations.map((a: { name: string }) => a.name)).toEqual(
        expect.arrayContaining(['prospect_campaign', 'lead_campaign', 'contact_campaign']),
      );
      const prospect = (await mcp.call('describe_object_type', { object: 'prospect' })).data;
      expect(prospect.associations.map((a: { name: string }) => a.name)).toContain('prospect_campaign');
      // The tools offer lists, and one record by itself.
      const tools = await mcp.tools();
      for (const name of ['link_record', 'unlink_record']) {
        const props = Object.keys((tools.find((t) => t.name === name)!.inputSchema as { properties: object }).properties);
        expect({ tool: name, props }).toEqual({
          tool: name,
          props: expect.arrayContaining(['record_id', 'record_ids']),
        });
      }

      // The procedure is published to clients, and every tool and link it names is real.
      const uri = 'skill://manage-campaign/SKILL.md';
      expect((await mcp.client.listResources()).resources.map((r) => r.uri)).toContain(uri);
      const text = ((await mcp.client.readResource({ uri })).contents[0] as { text: string }).text;
      expect(text).toMatch(/^---\nname: manage-campaign\n/);
      const named = [...text.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g)].map((m) => m[1]);
      const toolNames = named.filter((n) => /_(record|records|object_type)$/.test(n));
      const linkNames = named.filter((n) => /^(prospect|lead|contact|company|deal)_campaign$/.test(n));
      expect(toolNames).toEqual(expect.arrayContaining(['link_record', 'unlink_record', 'create_record', 'filter_records']));
      expect(linkNames.length).toBeGreaterThan(2);
      const toolSet = new Set(tools.map((t) => t.name));
      const linkSet = new Set<string>();
      for (const object of ['prospect', 'lead', 'contact', 'company', 'deal']) {
        for (const a of (await mcp.call('describe_object_type', { object })).data.associations) linkSet.add(a.name);
      }
      for (const name of new Set(toolNames)) expect(toolSet.has(name), `tool ${name}`).toBe(true);
      for (const name of new Set(linkNames)) expect(linkSet.has(name), `link ${name}`).toBe(true);
    } finally {
      await mcp.close();
    }
  });

  it('creates a prospect and adds it to a campaign found by name', async () => {
    const mcp = await openSession((await connect(owner, `e2e-campaigns-${run}-one`, SCOPES)).accessToken);
    const call = mcp.call as Tool;
    try {
      const campaign = await created(call, 'campaign', {
        name: `Spring ${run}`,
        status: 'active',
        type: 'email',
      });
      await created(call, 'campaign', { name: `Autumn ${run}`, status: 'draft' });
      const found = await call('filter_records', {
        object: 'campaign',
        filter_groups: [{ filters: [{ field_path: 'name', operator: 'CONTAINS', value: `Spring ${run}` }] }],
      });
      expect(found.data.results.map((r: { id: string }) => r.id)).toEqual([campaign]);

      const prospect = await created(call, 'prospect', {
        first_name: 'Farah',
        email: `farah${suffix}`,
        status: 'new',
      });
      const linked = await call('link_record', {
        object: 'prospect',
        id: prospect,
        link: 'prospect_campaign',
        record_id: campaign,
      });
      expect(linked.isError).toBe(false);
      expect(await members(call, campaign, 'prospect_campaign')).toEqual([prospect]);
      // Linking again changes nothing, and from the person's side the campaign shows.
      expect((await call('link_record', { object: 'prospect', id: prospect, link: 'prospect_campaign', record_id: campaign })).isError).toBe(false);
      expect(await members(call, campaign, 'prospect_campaign')).toEqual([prospect]);
      const theirs = await call('list_linked_records', { object: 'prospect', id: prospect, link: 'prospect_campaign' });
      expect(theirs.data.results.map((r: { id: string }) => r.id)).toEqual([campaign]);

      // The same email again is refused and says which prospect it is.
      const dup = await call('create_record', {
        object: 'prospect',
        properties: { first_name: 'Farah', email: `FARAH${suffix}` },
      });
      expect(dup.isError).toBe(true);
      expect(JSON.stringify(dup.data)).toContain(prospect);
    } finally {
      await mcp.close();
    }
  });

  it('enrols prospects and leads in one call, and refuses a list with a bad id as a whole', async () => {
    const mcp = await openSession((await connect(owner, `e2e-campaigns-${run}-bulk`, SCOPES)).accessToken);
    const call = mcp.call as Tool;
    try {
      const campaign = await created(call, 'campaign', { name: `Bulk ${run}`, status: 'active' });
      const prospects: string[] = [];
      for (let i = 0; i < 12; i++) prospects.push(await created(call, 'prospect', { first_name: `P${i}` }));
      const leads: string[] = [];
      for (let i = 0; i < 3; i++) leads.push(await created(call, 'lead', { first_name: `L${i}` }));

      // From the campaign's end, one call for the lot.
      const added = await call('link_record', {
        object: 'campaign',
        id: campaign,
        link: 'prospect_campaign',
        record_ids: prospects,
      });
      expect(added.isError).toBe(false);
      expect(sorted(added.data.results.map((r: { id: string }) => r.id))).toEqual(sorted(prospects));
      expect(sorted(await members(call, campaign, 'prospect_campaign'))).toEqual(sorted(prospects));
      // From a person's end, to several campaigns at once.
      const second = await created(call, 'campaign', { name: `Bulk two ${run}` });
      const third = await created(call, 'campaign', { name: `Bulk three ${run}` });
      await call('link_record', { object: 'lead', id: leads[0], link: 'lead_campaign', record_ids: [second, third] });
      expect(await members(call, second, 'lead_campaign')).toEqual([leads[0]]);
      expect(await members(call, third, 'lead_campaign')).toEqual([leads[0]]);
      // Leads are their own list.
      await call('link_record', { object: 'campaign', id: campaign, link: 'lead_campaign', record_ids: leads });
      expect(sorted(await members(call, campaign, 'lead_campaign'))).toEqual(sorted(leads));
      expect(await members(call, campaign, 'prospect_campaign')).toHaveLength(12);

      // One id that is not a prospect (a lead's id is not in the prospect list), or does not exist:
      // the call fails, names it, and links nothing.
      const extra = await created(call, 'prospect', { first_name: 'Extra' });
      for (const bad of ['999999999', second]) {
        const refused = await call('link_record', {
          object: 'campaign',
          id: campaign,
          link: 'prospect_campaign',
          record_ids: [extra, bad],
        });
        expect({ bad, isError: refused.isError }).toEqual({ bad, isError: true });
        expect(JSON.stringify(refused.data)).toContain(bad);
      }
      expect(sorted(await members(call, campaign, 'prospect_campaign'))).toEqual(sorted(prospects));

      // Removing several, all or none.
      const half = prospects.slice(0, 5);
      const stranger = extra;
      const notAll = await call('unlink_record', {
        object: 'campaign',
        id: campaign,
        link: 'prospect_campaign',
        record_ids: [half[0], stranger],
      });
      expect(notAll.isError).toBe(true);
      expect(JSON.stringify(notAll.data)).toContain(stranger);
      expect(await members(call, campaign, 'prospect_campaign')).toHaveLength(12);
      const removed = await call('unlink_record', {
        object: 'campaign',
        id: campaign,
        link: 'prospect_campaign',
        record_ids: half,
      });
      expect(removed.isError).toBe(false);
      expect(sorted(await members(call, campaign, 'prospect_campaign'))).toEqual(sorted(prospects.slice(5)));
      // The prospects themselves are untouched.
      expect((await call('get_record', { object: 'prospect', id: half[0] })).isError).toBe(false);
    } finally {
      await mcp.close();
    }
  }, 30_000);

  it('keeps a member to what they can see, and a read-only token to reading', async () => {
    const own = await openSession((await connect(alice, `e2e-campaigns-${run}-alice`, SCOPES)).accessToken);
    const owners = await openSession((await connect(owner, `e2e-campaigns-${run}-owner2`, SCOPES)).accessToken);
    const reader = await openSession(
      (await connect(owner, `e2e-campaigns-${run}-reader`, 'records:read schema:read')).accessToken,
    );
    const mine = own.call as Tool;
    const theirs = owners.call as Tool;
    try {
      const ownersCampaign = await created(theirs, 'campaign', { name: `Owner only ${run}` });
      const ownersProspect = await created(theirs, 'prospect', { first_name: 'Hidden' });
      const aliceCampaign = await created(mine, 'campaign', { name: `Alice ${run}` });
      const aliceProspects = [await created(mine, 'prospect', { first_name: 'A1' }), await created(mine, 'prospect', { first_name: 'A2' })];

      // Alice enrols her own in her own campaign.
      expect(
        (await mine('link_record', { object: 'campaign', id: aliceCampaign, link: 'prospect_campaign', record_ids: aliceProspects })).isError,
      ).toBe(false);
      // A list that includes someone else's prospect fails whole, and does not say it exists.
      const mixed = await mine('link_record', {
        object: 'campaign',
        id: aliceCampaign,
        link: 'prospect_campaign',
        record_ids: [...aliceProspects, ownersProspect],
      });
      expect(mixed.isError).toBe(true);
      expect(await members(mine, aliceCampaign, 'prospect_campaign')).toHaveLength(2);
      // Nor can she reach the owner's campaign.
      const intoOwners = await mine('link_record', {
        object: 'campaign',
        id: ownersCampaign,
        link: 'prospect_campaign',
        record_ids: aliceProspects,
      });
      expect(intoOwners.isError).toBe(true);
      expect(await members(theirs, ownersCampaign, 'prospect_campaign')).toEqual([]);

      // A token that may only read can look, and cannot link or unlink.
      const read = reader.call as Tool;
      expect(await members(read, aliceCampaign, 'prospect_campaign')).toHaveLength(2);
      // The server refuses the call itself for want of the write scope; the client throws.
      for (const tool of ['link_record', 'unlink_record']) {
        await expect(
          read(tool, {
            object: 'campaign',
            id: aliceCampaign,
            link: 'prospect_campaign',
            record_ids: [aliceProspects[0]],
          }),
        ).rejects.toThrow(/403|forbidden|scope/i);
      }
      expect(await members(theirs, aliceCampaign, 'prospect_campaign')).toHaveLength(2);
    } finally {
      await Promise.all([own.close(), owners.close(), reader.close()]);
    }
  }, 30_000);
});
