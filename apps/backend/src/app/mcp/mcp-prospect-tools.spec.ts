import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  CAMPAIGN_DISPOSITION_VALUES,
  CAMPAIGN_EVENT_VALUES,
  PROSPECT_STATUS_VALUES,
} from '@zuko/sales';
import { buildMcpServer } from './mcp-server';

const PROSPECT = {
  id: 7,
  organizationId: 1,
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  status: 'new',
  memberships: [],
};

function prospectDb(orgIds: number[] = [1]) {
  return {
    member: {
      findMany: vi.fn(async () =>
        orgIds.map((organizationId) => ({ organizationId })),
      ),
    },
  } as never;
}

function prospectsSvc(over: Record<string, unknown> = {}) {
  return {
    prospects: {
      findAll: vi.fn(async () => ({
        data: [PROSPECT],
        total: 1,
        page: 1,
        perPage: 50,
        totalPages: 1,
      })),
      findById: vi.fn(async () => PROSPECT),
      findEvents: vi.fn(async () => [
        { id: 1, eventType: 'enrolled', occurredAt: new Date('2026-09-01') },
      ]),
      create: vi.fn(async () => PROSPECT),
      enrol: vi.fn(async () => ({ id: 33, state: 'enrolled' })),
      recordEvent: vi.fn(async () => ({ id: 33, engagement: 'contacted' })),
      setDisposition: vi.fn(async () => ({ id: 33, disposition: 'nurture' })),
      setStatus: vi.fn(async () => ({ ...PROSPECT, status: 'enrolled' })),
      promote: vi.fn(async () => ({
        prospect: { ...PROSPECT, status: 'promoted' },
        lead: { id: 90, status: 'replied' },
      })),
      suppress: vi.fn(async () => ({ ...PROSPECT, status: 'suppressed' })),
      setConsent: vi.fn(async () => ({ ...PROSPECT, emailConsent: 'revoked' })),
      ...over,
    },
  };
}

async function connect(prisma: unknown, scopes: string[], deps?: unknown) {
  const server = buildMcpServer(
    prisma as never,
    { userId: 42, scopes },
    deps as never,
  );
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientT);
  return client;
}

const parse = (res: unknown) =>
  JSON.parse((res as { content: { text: string }[] }).content[0].text);

const text = (res: unknown) =>
  (res as { content: { text: string }[] }).content[0].text;

const isError = (res: unknown) => (res as { isError?: boolean }).isError;

describe('prospect MCP tools', () => {
  describe('tool surface', () => {
    it('Registers the whole prospect surface', async () => {
      const client = await connect(prospectDb(), [], prospectsSvc());
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);

      expect(names).toEqual(
        expect.arrayContaining([
          'list_prospects',
          'get_prospect',
          'get_prospect_events',
          'create_prospect',
          'enrol_prospect',
          'record_campaign_event',
          'set_prospect_disposition',
          'set_prospect_status',
          'promote_prospect',
          'suppress_prospect',
        ]),
      );
    });

    it('Builds its enums from the shared constants, so they cannot drift', async () => {
      const client = await connect(prospectDb(), [], prospectsSvc());
      const { tools } = await client.listTools();

      const enumOf = (toolName: string, property: string) => {
        const tool = tools.find((t) => t.name === toolName);
        if (!tool) throw new Error(`tool ${toolName} is not registered`);
        const schema = tool.inputSchema as {
          properties: Record<string, { enum?: string[] }>;
        };
        return schema.properties[property]?.enum;
      };

      expect(enumOf('set_prospect_status', 'status')).toEqual(
        PROSPECT_STATUS_VALUES,
      );
      expect(enumOf('record_campaign_event', 'eventType')).toEqual(
        CAMPAIGN_EVENT_VALUES,
      );
      expect(enumOf('set_prospect_disposition', 'disposition')).toEqual(
        CAMPAIGN_DISPOSITION_VALUES,
      );
    });
  });

  describe('scopes', () => {
    it('Rejects a read without prospects:read', async () => {
      const client = await connect(prospectDb(), [], prospectsSvc());
      const res = await client.callTool({
        name: 'list_prospects',
        arguments: {},
      });

      expect(isError(res)).toBe(true);
      expect(text(res)).toContain('prospects:read');
    });

    it('Rejects a write when the token only grants reads', async () => {
      const client = await connect(
        prospectDb(),
        ['prospects:read'],
        prospectsSvc(),
      );
      const res = await client.callTool({
        name: 'promote_prospect',
        arguments: { prospectId: 7 },
      });

      expect(isError(res)).toBe(true);
      expect(text(res)).toContain('prospects:write');
    });

    it('Does not let a lead scope stand in for a prospect scope', async () => {
      const client = await connect(
        prospectDb(),
        ['leads:read', 'leads:write'],
        prospectsSvc(),
      );
      const res = await client.callTool({
        name: 'list_prospects',
        arguments: {},
      });

      expect(isError(res)).toBe(true);
    });
  });

  describe('organization resolution', () => {
    it('Infers the organization when the user has exactly one', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb([1]), ['prospects:read'], deps);
      await client.callTool({ name: 'list_prospects', arguments: {} });

      expect(deps.prospects.findAll).toHaveBeenCalledWith(
        1,
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('Asks which organization when the user belongs to several', async () => {
      const client = await connect(
        prospectDb([1, 2]),
        ['prospects:read'],
        prospectsSvc(),
      );
      const res = await client.callTool({
        name: 'list_prospects',
        arguments: {},
      });

      expect(isError(res)).toBe(true);
      expect(text(res)).toContain('list_organizations');
    });

    it('Refuses an organization the user does not belong to', async () => {
      const client = await connect(
        prospectDb([1]),
        ['prospects:read'],
        prospectsSvc(),
      );
      const res = await client.callTool({
        name: 'list_prospects',
        arguments: { organizationId: 99 },
      });

      expect(isError(res)).toBe(true);
      expect(text(res)).toContain('do not have access');
    });
  });

  describe('reads', () => {
    it('Lists prospects and passes the filters through', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb(), ['prospects:read'], deps);
      const res = await client.callTool({
        name: 'list_prospects',
        arguments: { status: 'enrolled', campaignId: 4, search: 'ada' },
      });

      expect(parse(res).total).toBe(1);
      expect(deps.prospects.findAll).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: ['enrolled'],
          campaignId: 4,
          search: 'ada',
        }),
        1,
        50,
      );
    });

    it('Returns one prospect with its campaign history', async () => {
      const client = await connect(
        prospectDb(),
        ['prospects:read'],
        prospectsSvc(),
      );
      const res = await client.callTool({
        name: 'get_prospect',
        arguments: { prospectId: 7 },
      });

      expect(parse(res).id).toBe(7);
    });

    it('Returns the event history', async () => {
      const client = await connect(
        prospectDb(),
        ['prospects:read'],
        prospectsSvc(),
      );
      const res = await client.callTool({
        name: 'get_prospect_events',
        arguments: { prospectId: 7 },
      });

      expect(parse(res)[0].eventType).toBe('enrolled');
    });
  });

  describe('writes', () => {
    it('Creates a prospect through the service, so identity resolution runs', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb(), ['prospects:write'], deps);
      await client.callTool({
        name: 'create_prospect',
        arguments: { name: 'Ada Lovelace', email: 'ada@example.com' },
      });

      expect(deps.prospects.create).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'Ada Lovelace' }),
      );
    });

    it('Does not pass organizationId through as a prospect field', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb(), ['prospects:write'], deps);
      await client.callTool({
        name: 'create_prospect',
        arguments: { name: 'Ada', organizationId: 1 },
      });

      const input = deps.prospects.create.mock.calls[0][1];
      expect(input).not.toHaveProperty('organizationId');
    });

    it('Enrols a prospect, attributing the action to the agent', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb(), ['prospects:write'], deps);
      await client.callTool({
        name: 'enrol_prospect',
        arguments: { prospectId: 7, campaignId: 4 },
      });

      expect(deps.prospects.enrol).toHaveBeenCalledWith(
        7,
        1,
        4,
        expect.objectContaining({
          actor: { userId: 42, source: 'agent' },
        }),
      );
    });

    it('Never lets an agent override the enrolment safeguards', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb(), ['prospects:write'], deps);
      await client.callTool({
        name: 'enrol_prospect',
        arguments: { prospectId: 7, campaignId: 4, force: true },
      });

      const options = deps.prospects.enrol.mock.calls[0][3];
      expect(options.force).toBeUndefined();
    });

    it('Records a campaign event with its provider id for idempotent replay', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb(), ['prospects:write'], deps);
      await client.callTool({
        name: 'record_campaign_event',
        arguments: {
          membershipId: 33,
          eventType: 'reply_received',
          externalId: 'evt-1',
        },
      });

      expect(deps.prospects.recordEvent).toHaveBeenCalledWith(
        33,
        1,
        'reply_received',
        undefined,
        'evt-1',
        undefined,
        { userId: 42, source: 'agent' },
      );
    });

    it('Promotes a prospect to a lead', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb(), ['prospects:write'], deps);
      const res = await client.callTool({
        name: 'promote_prospect',
        arguments: { prospectId: 7 },
      });

      expect(parse(res).lead.id).toBe(90);
      expect(deps.prospects.promote).toHaveBeenCalledWith(7, 1);
    });

    it('Revokes a single channel when one is named', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb(), ['prospects:write'], deps);
      await client.callTool({
        name: 'suppress_prospect',
        arguments: { prospectId: 7, channel: 'email' },
      });

      expect(deps.prospects.setConsent).toHaveBeenCalledWith(
        7,
        1,
        'email',
        'revoked',
      );
      expect(deps.prospects.suppress).not.toHaveBeenCalled();
    });

    it('Suppresses outright when no channel is named', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb(), ['prospects:write'], deps);
      await client.callTool({
        name: 'suppress_prospect',
        arguments: { prospectId: 7 },
      });

      expect(deps.prospects.suppress).toHaveBeenCalledWith(7, 1);
    });
  });

  describe('the state machine cannot be bypassed', () => {
    it('Never offers an agent the manual flag that lifts suppression', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb(), ['prospects:write'], deps);
      await client.callTool({
        name: 'set_prospect_status',
        arguments: { prospectId: 7, status: 'new', manual: true },
      });

      // Only three args — the service applies its non-manual rules.
      expect(deps.prospects.setStatus).toHaveBeenCalledWith(7, 1, 'new');
    });

    it('Surfaces a refused transition as a tool error, not a silent success', async () => {
      const deps = prospectsSvc({
        setStatus: vi.fn(async () => {
          throw new Error('Cannot move a prospect from "new" to "promoted"');
        }),
      });
      const client = await connect(prospectDb(), ['prospects:write'], deps);
      const res = await client.callTool({
        name: 'set_prospect_status',
        arguments: { prospectId: 7, status: 'promoted' },
      });

      expect(isError(res)).toBe(true);
      expect(text(res)).toContain('Cannot move a prospect');
    });

    it('Rejects an event type outside the vocabulary before it reaches the service', async () => {
      const deps = prospectsSvc();
      const client = await connect(prospectDb(), ['prospects:write'], deps);
      const res = await client.callTool({
        name: 'record_campaign_event',
        arguments: { membershipId: 33, eventType: 'telepathy' },
      });

      expect(isError(res)).toBe(true);
      expect(deps.prospects.recordEvent).not.toHaveBeenCalled();
    });

    it('Reports a missing prospect service instead of pretending to work', async () => {
      const client = await connect(prospectDb(), ['prospects:read'], {});
      const res = await client.callTool({
        name: 'list_prospects',
        arguments: {},
      });

      expect(isError(res)).toBe(true);
      expect(text(res)).toContain('not available');
    });
  });
});
