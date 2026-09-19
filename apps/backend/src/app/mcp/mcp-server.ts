import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Prisma, type TaskStatus } from '@prisma/client';
import type { PrismaClient } from '@zuko/models';
import type {
  DealsService,
  CompaniesService,
  ContactsService,
  ActivityService,
  ProspectsService,
} from '@zuko/sales';
import {
  CAMPAIGN_DISPOSITION_VALUES,
  CAMPAIGN_EVENT_VALUES,
  CONTACT_CHANNEL_VALUES,
  DEAL_STAGE_VALUES,
  ENGAGEMENT_STATE_VALUES,
  PROSPECT_STATUS_VALUES,
} from '@zuko/sales';
import { z } from 'zod';
import type { IcpService } from '../icp/icp.service';
import type { LeadsService } from '../leads/leads.service';
import type { ApolloSequencesService } from '../integrations/apollo/sequences/apollo-sequences.service';

export interface McpAuthContext {
  userId: number;
  scopes: string[];
}

/**
 * Optional NestJS services the controller wires in. Deal and company writes
 * go through their services so they run the same validation and emit the
 * same activity-feed events as the REST API; reads stay on prisma for full
 * control of ordering and org scoping.
 */
export interface McpDeps {
  deals: DealsService;
  companies: CompaniesService;
  contacts: ContactsService;
  icps: IcpService;
  leads: LeadsService;
  campaigns: ApolloSequencesService;
  activity: ActivityService;
  prospects: ProspectsService;
}

/** Activity has no organizationId, so comment tools resolve the commented-on entity's org and check it against the caller's memberships. */
const COMMENT_ENTITY_TYPES = ['task', 'deal', 'company', 'contact'] as const;

async function resolveEntityOrgId(
  prisma: PrismaClient,
  entityType: (typeof COMMENT_ENTITY_TYPES)[number],
  entityId: number,
): Promise<number | null> {
  switch (entityType) {
    case 'deal': {
      const deal = await prisma.deal.findUnique({
        where: { id: entityId },
        select: { organizationId: true },
      });
      return deal?.organizationId ?? null;
    }
    case 'company': {
      const company = await prisma.company.findUnique({
        where: { id: entityId },
        select: { organizationId: true },
      });
      return company?.organizationId ?? null;
    }
    case 'contact': {
      const contact = await prisma.contact.findUnique({
        where: { id: entityId },
        select: { organizationId: true },
      });
      return contact?.organizationId ?? null;
    }
    case 'task': {
      const task = await prisma.task.findUnique({
        where: { id: entityId },
        select: { organizationId: true },
      });
      return task?.organizationId ?? null;
    }
  }
}

/** Prisma Decimal (e.g. Deal.value) does not JSON-serialize to a number. */
const money = (v: unknown): number | null => (v == null ? null : Number(v));

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

const json = (data: unknown): ToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});

const missingScope = (scope: string): ToolResult => ({
  isError: true,
  content: [
    {
      type: 'text',
      text: `Access token is missing the required scope "${scope}".`,
    },
  ],
});

const toolError = (message: string): ToolResult => ({
  isError: true,
  content: [{ type: 'text', text: message }],
});

/**
 * Builds a tool enum from a shared @zuko/sales constant, so the agent surface
 * and the domain cannot drift: a value added there reaches the tools with no
 * second edit.
 */
const mcpEnum = (values: string[]) => z.enum(values as [string, ...string[]]);

/**
 * Builds a per-request MCP server whose tools run as the token's user.
 * Every query is bounded by the organizations the user is a member of;
 * each tool additionally requires its OAuth scope (tasks:read / tasks:write)
 * from the verified access token.
 */
export function buildMcpServer(
  prisma: PrismaClient,
  authCtx: McpAuthContext,
  deps?: McpDeps,
): McpServer {
  const server = new McpServer({ name: 'zuko', version: '0.1.0' });

  const memberOrgIds = async () => {
    const members = await prisma.member.findMany({
      where: { userId: authCtx.userId },
      select: { organizationId: true },
    });
    return members.map((m: { organizationId: number }) => m.organizationId);
  };

  server.registerTool(
    'list_organizations',
    {
      description:
        'List the organizations the authorized user belongs to (id, name, slug, and role). Use an id as organizationId when creating tasks and the user belongs to multiple organizations.',
      inputSchema: {},
    },
    async () => {
      if (!authCtx.scopes.includes('organizations:read')) {
        return missingScope('organizations:read');
      }
      const memberships = await prisma.member.findMany({
        where: { userId: authCtx.userId },
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { organization: { name: 'asc' } },
      });
      return json(
        memberships.map(
          (m: {
            role: string;
            organization: { id: number; name: string; slug: string };
          }) => ({ ...m.organization, role: m.role }),
        ),
      );
    },
  );

  server.registerTool(
    'list_tasks',
    {
      description:
        'List tasks in the organizations the authorized user belongs to. Returns the 50 most recently updated.',
      inputSchema: {
        status: z
          .enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
          .optional()
          .describe('Filter by task status'),
        organizationId: z
          .number()
          .optional()
          .describe('Restrict results to a specific organization'),
      },
    },
    async ({ status, organizationId }) => {
      if (!authCtx.scopes.includes('tasks:read')) {
        return missingScope('tasks:read');
      }

      const orgIds = await memberOrgIds();

      const tasks = await prisma.task.findMany({
        where: {
          organizationId: organizationId ? organizationId : { in: orgIds },
          ...(status !== undefined ? { status } : {}),
        },
        select: {
          id: true,
          organizationId: true,
          title: true,
          description: true,
          status: true,
          completedAt: true,
          assignee: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
      return json(tasks);
    },
  );

  server.registerTool(
    'get_task',
    {
      description: 'Get detailed information about a specific task by ID.',
      inputSchema: {
        taskId: z.int().describe('The ID of the task to retrieve'),
      },
    },
    async ({ taskId }) => {
      if (!authCtx.scopes.includes('tasks:read')) {
        return missingScope('tasks:read');
      }

      const orgIds = await memberOrgIds();

      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          organizationId: { in: orgIds },
        },
        include: {
          owners: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          subtasks: {
            select: {
              id: true,
              title: true,
              status: true,
              completedAt: true,
            },
          },
          parent: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });

      if (!task) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Task with ID ${taskId} not found or not accessible.`,
            },
          ],
        };
      }

      return json(task);
    },
  );

  server.registerTool(
    'create_task',
    {
      description:
        'Create a new task in an organization. organizationId is optional when the user belongs to exactly one organization — call list_organizations first to pick one if needed.',
      inputSchema: {
        organizationId: z
          .int()
          .optional()
          .describe(
            'Organization ID to create the task in. Omit if you belong to exactly one organization; call list_organizations to find the correct id otherwise.',
          ),
        title: z.string().describe('The title of the task'),
        description: z
          .any()
          .optional()
          .describe('Optional description (JSON format)'),
        status: z
          .enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
          .optional()
          .default('TODO')
          .describe('Initial status of the task'),
        assignee: z
          .string()
          .optional()
          .describe('Optional assignee identifier'),
      },
    },
    async ({ organizationId, title, description, status, assignee }) => {
      if (!authCtx.scopes.includes('tasks:write')) {
        return missingScope('tasks:write');
      }

      const orgIds = await memberOrgIds();

      let resolvedOrgId = organizationId;
      if (resolvedOrgId === undefined) {
        if (orgIds.length === 0) {
          return toolError('User is not a member of any organization.');
        }
        if (orgIds.length > 1) {
          return toolError(
            `User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.`,
          );
        }
        resolvedOrgId = orgIds[0];
      } else if (!orgIds.includes(resolvedOrgId)) {
        return toolError(
          `You do not have access to organization ${resolvedOrgId}.`,
        );
      }

      const task = await prisma.task.create({
        data: {
          organizationId: resolvedOrgId,
          title,
          description: description || null,
          status: status || 'TODO',
          assignee: assignee || null,
        },
        select: {
          id: true,
          organizationId: true,
          title: true,
          description: true,
          status: true,
          assignee: true,
          createdAt: true,
        },
      });

      return json(task);
    },
  );

  server.registerTool(
    'update_task',
    {
      description: 'Update an existing task.',
      inputSchema: {
        taskId: z.int().describe('The ID of the task to update'),
        title: z.string().optional().describe('New title for the task'),
        description: z
          .any()
          .optional()
          .describe('New description (JSON format)'),
        status: z
          .enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'])
          .optional()
          .describe('New status for the task'),
        assignee: z.string().optional().describe('New assignee identifier'),
        completedAt: z
          .string()
          .optional()
          .describe('Completion timestamp (ISO 8601 format)'),
      },
    },
    async ({ taskId, title, description, status, assignee, completedAt }) => {
      if (!authCtx.scopes.includes('tasks:write')) {
        return missingScope('tasks:write');
      }

      const orgIds = await memberOrgIds();

      const existingTask = await prisma.task.findFirst({
        where: {
          id: taskId,
          organizationId: { in: orgIds },
        },
      });

      if (!existingTask) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Task with ID ${taskId} not found or not accessible.`,
            },
          ],
        };
      }

      const updateData: {
        title?: string;
        description?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput;
        status?: TaskStatus;
        assignee?: string;
        completedAt?: Date;
      } = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined)
        updateData.description =
          description === null
            ? Prisma.JsonNull
            : (description as Prisma.InputJsonValue);
      if (status !== undefined) updateData.status = status as TaskStatus;
      if (assignee !== undefined) updateData.assignee = assignee;
      if (completedAt !== undefined) {
        updateData.completedAt = new Date(completedAt);
      }

      const task = await prisma.task.update({
        where: { id: taskId },
        data: updateData,
        select: {
          id: true,
          organizationId: true,
          title: true,
          description: true,
          status: true,
          assignee: true,
          completedAt: true,
          updatedAt: true,
        },
      });

      return json(task);
    },
  );

  const dealStage = z.enum(DEAL_STAGE_VALUES as [string, ...string[]]);

  server.registerTool(
    'list_deals',
    {
      description:
        'List deals in the organizations the authorized user belongs to. Returns the 50 most recently updated.',
      inputSchema: {
        stage: dealStage.optional().describe('Filter by pipeline stage'),
        organizationId: z
          .number()
          .optional()
          .describe('Restrict results to a specific organization'),
        mine: z
          .boolean()
          .optional()
          .describe('Only deals where the authorized user is an owner'),
      },
    },
    async ({ stage, organizationId, mine }) => {
      if (!authCtx.scopes.includes('deals:read')) {
        return missingScope('deals:read');
      }

      const orgIds = await memberOrgIds();
      if (organizationId && !orgIds.includes(organizationId)) {
        return toolError(
          `You do not have access to organization ${organizationId}.`,
        );
      }

      const deals = await prisma.deal.findMany({
        where: {
          organizationId: organizationId ? organizationId : { in: orgIds },
          ...(stage !== undefined ? { stage } : {}),
          ...(mine ? { owners: { some: { userId: authCtx.userId } } } : {}),
        },
        select: {
          id: true,
          organizationId: true,
          title: true,
          value: true,
          currency: true,
          stage: true,
          probability: true,
          priority: true,
          expectedCloseDate: true,
          actualCloseDate: true,
          isHidden: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });

      return json(deals.map((d) => ({ ...d, value: money(d.value) })));
    },
  );

  server.registerTool(
    'get_deal',
    {
      description:
        'Get detailed information about a specific deal by ID, including owners, linked companies, and linked contacts.',
      inputSchema: {
        dealId: z.int().describe('The ID of the deal to retrieve'),
      },
    },
    async ({ dealId }) => {
      if (!authCtx.scopes.includes('deals:read')) {
        return missingScope('deals:read');
      }

      const orgIds = await memberOrgIds();

      const deal = await prisma.deal.findFirst({
        where: { id: dealId, organizationId: { in: orgIds } },
        include: {
          owners: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          companies: {
            include: {
              company: { select: { id: true, companyName: true } },
            },
          },
          contacts: {
            include: {
              contact: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      if (!deal) {
        return toolError(`Deal with ID ${dealId} not found or not accessible.`);
      }

      return json({ ...deal, value: money(deal.value) });
    },
  );

  server.registerTool(
    'create_deal',
    {
      description:
        'Create a new deal in an organization. organizationId is optional when the user belongs to exactly one organization — call list_organizations first to pick one if needed.',
      inputSchema: {
        organizationId: z
          .int()
          .optional()
          .describe(
            'Organization ID to create the deal in. Omit if you belong to exactly one organization; call list_organizations to find the correct id otherwise.',
          ),
        title: z.string().describe('The title of the deal'),
        value: z.number().optional().describe('Monetary value of the deal'),
        currency: z
          .string()
          .optional()
          .describe('ISO currency code (default USD)'),
        stage: dealStage.optional().describe('Initial pipeline stage'),
        probability: z.number().optional().describe('Win probability, 0-100'),
        priority: z
          .number()
          .optional()
          .describe('Priority, 0 (critical) to 4 (backlog)'),
        expectedCloseDate: z
          .string()
          .optional()
          .describe('Expected close date (ISO 8601)'),
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('deals:write')) {
        return missingScope('deals:write');
      }
      if (!deps?.deals) {
        return toolError('Deal management is not available.');
      }

      const orgIds = await memberOrgIds();

      let resolvedOrgId = args.organizationId;
      if (resolvedOrgId === undefined) {
        if (orgIds.length === 0) {
          return toolError('User is not a member of any organization.');
        }
        if (orgIds.length > 1) {
          return toolError(
            `User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.`,
          );
        }
        resolvedOrgId = orgIds[0];
      } else if (!orgIds.includes(resolvedOrgId)) {
        return toolError(
          `You do not have access to organization ${resolvedOrgId}.`,
        );
      }

      try {
        const deal = await deps.deals.create(
          {
            organizationId: resolvedOrgId,
            title: args.title,
            value: args.value,
            currency: args.currency,
            stage: args.stage,
            probability: args.probability,
            priority: args.priority,
            expectedCloseDate: args.expectedCloseDate
              ? new Date(args.expectedCloseDate)
              : undefined,
          },
          authCtx.userId,
          'mcp',
        );
        return json({ ...deal, value: money(deal.value) });
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'update_deal',
    {
      description:
        'Update an existing deal. Stage changes and closings are recorded on the deal activity timeline.',
      inputSchema: {
        dealId: z.int().describe('The ID of the deal to update'),
        title: z.string().optional().describe('New title'),
        stage: dealStage.optional().describe('New pipeline stage'),
        value: z.number().optional().describe('New monetary value'),
        currency: z.string().optional().describe('New ISO currency code'),
        probability: z
          .number()
          .optional()
          .describe('New win probability, 0-100'),
        priority: z
          .number()
          .optional()
          .describe('New priority, 0 (critical) to 4 (backlog)'),
        expectedCloseDate: z
          .string()
          .optional()
          .describe('New expected close date (ISO 8601)'),
        actualCloseDate: z
          .string()
          .optional()
          .describe('Actual close date (ISO 8601) — set when the deal closes'),
        lostReason: z.string().optional().describe('Reason the deal was lost'),
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('deals:write')) {
        return missingScope('deals:write');
      }
      if (!deps?.deals) {
        return toolError('Deal management is not available.');
      }

      const orgIds = await memberOrgIds();

      const existing = await prisma.deal.findFirst({
        where: { id: args.dealId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(
          `Deal with ID ${args.dealId} not found or not accessible.`,
        );
      }

      try {
        const deal = await deps.deals.update(
          args.dealId,
          existing.organizationId,
          {
            title: args.title,
            stage: args.stage,
            value: args.value,
            currency: args.currency,
            probability: args.probability,
            priority: args.priority,
            expectedCloseDate: args.expectedCloseDate
              ? new Date(args.expectedCloseDate)
              : undefined,
            actualCloseDate: args.actualCloseDate
              ? new Date(args.actualCloseDate)
              : undefined,
            lostReason: args.lostReason,
          },
          authCtx.userId,
          'mcp',
        );
        return json({ ...deal, value: money(deal.value) });
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'list_companies',
    {
      description:
        'List companies in the organizations the authorized user belongs to. Returns up to 50 companies, oldest first.',
      inputSchema: {
        organizationId: z
          .number()
          .optional()
          .describe('Restrict results to a specific organization'),
        search: z
          .string()
          .optional()
          .describe('Search by company name, website, or LinkedIn URL'),
        mine: z
          .boolean()
          .optional()
          .describe('Only companies where the authorized user is an owner'),
      },
    },
    async ({ organizationId, search, mine }) => {
      if (!authCtx.scopes.includes('companies:read')) {
        return missingScope('companies:read');
      }

      const orgIds = await memberOrgIds();
      if (organizationId && !orgIds.includes(organizationId)) {
        return toolError(
          `You do not have access to organization ${organizationId}.`,
        );
      }

      const companies = await prisma.company.findMany({
        where: {
          organizationId: organizationId ? organizationId : { in: orgIds },
          isHidden: false,
          ...(search !== undefined
            ? {
                OR: [
                  { companyName: { contains: search, mode: 'insensitive' } },
                  { website: { contains: search, mode: 'insensitive' } },
                  { linkedinUrl: { contains: search, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(mine ? { owners: { some: { userId: authCtx.userId } } } : {}),
        },
        select: {
          id: true,
          organizationId: true,
          companyName: true,
          website: true,
          linkedinUrl: true,
          isHidden: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });

      return json(companies);
    },
  );

  server.registerTool(
    'get_company',
    {
      description:
        'Get detailed information about a specific company by ID, including owners and linked contacts.',
      inputSchema: {
        companyId: z.int().describe('The ID of the company to retrieve'),
      },
    },
    async ({ companyId }) => {
      if (!authCtx.scopes.includes('companies:read')) {
        return missingScope('companies:read');
      }

      const orgIds = await memberOrgIds();

      const company = await prisma.company.findFirst({
        where: { id: companyId, organizationId: { in: orgIds } },
        include: {
          owners: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          contacts: {
            where: { leftAt: null },
            include: {
              contact: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      if (!company) {
        return toolError(
          `Company with ID ${companyId} not found or not accessible.`,
        );
      }

      return json(company);
    },
  );

  server.registerTool(
    'create_company',
    {
      description:
        'Create a new company in an organization. organizationId is optional when the user belongs to exactly one organization — call list_organizations first to pick one if needed.',
      inputSchema: {
        organizationId: z
          .int()
          .optional()
          .describe(
            'Organization ID to create the company in. Omit if you belong to exactly one organization; call list_organizations to find the correct id otherwise.',
          ),
        companyName: z.string().describe('The name of the company'),
        website: z.string().optional().describe('Company website URL'),
        linkedinUrl: z.string().optional().describe('Company LinkedIn URL'),
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('companies:write')) {
        return missingScope('companies:write');
      }
      if (!deps?.companies) {
        return toolError('Company management is not available.');
      }

      const orgIds = await memberOrgIds();

      let resolvedOrgId = args.organizationId;
      if (resolvedOrgId === undefined) {
        if (orgIds.length === 0) {
          return toolError('User is not a member of any organization.');
        }
        if (orgIds.length > 1) {
          return toolError(
            `User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.`,
          );
        }
        resolvedOrgId = orgIds[0];
      } else if (!orgIds.includes(resolvedOrgId)) {
        return toolError(
          `You do not have access to organization ${resolvedOrgId}.`,
        );
      }

      try {
        const company = await deps.companies.create(
          {
            organizationId: resolvedOrgId,
            companyName: args.companyName,
            website: args.website,
            linkedinUrl: args.linkedinUrl,
          },
          authCtx.userId,
          'mcp',
        );
        return json(company);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'update_company',
    {
      description:
        'Update an existing company. Field changes are recorded on the company activity timeline.',
      inputSchema: {
        companyId: z.int().describe('The ID of the company to update'),
        companyName: z.string().optional().describe('New company name'),
        website: z.string().optional().describe('New company website URL'),
        linkedinUrl: z.string().optional().describe('New company LinkedIn URL'),
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('companies:write')) {
        return missingScope('companies:write');
      }
      if (!deps?.companies) {
        return toolError('Company management is not available.');
      }

      const orgIds = await memberOrgIds();

      const existing = await prisma.company.findFirst({
        where: { id: args.companyId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(
          `Company with ID ${args.companyId} not found or not accessible.`,
        );
      }

      try {
        const company = await deps.companies.update(
          args.companyId,
          existing.organizationId,
          {
            companyName: args.companyName,
            website: args.website,
            linkedinUrl: args.linkedinUrl,
          },
          authCtx.userId,
          'mcp',
        );
        return json(company);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'update_company_summary',
    {
      description:
        'Replace the free-form Editor.js summary document for a company. This replaces the ' +
        'entire document, so call get_company first if you need to preserve existing content ' +
        'and append to it. Supported block types: paragraph, header, list, checklist, quote, ' +
        'code, table, warning, delimiter. Inline formatting (bold/italic/highlight/inline-code) ' +
        'is embedded as HTML tags inside a block\'s "text" field, e.g. "<b>bold</b>" or ' +
        '"<mark>highlighted</mark>", not as separate block types.',
      inputSchema: {
        companyId: z.int().describe('The ID of the company to update'),
        summary: z
          .object({
            time: z.number().optional(),
            blocks: z
              .array(
                z
                  .object({
                    id: z.string().optional(),
                    type: z
                      .string()
                      .describe(
                        'Editor.js block type, e.g. "paragraph", "header", "list", "checklist", "quote", "code", "table", "warning", "delimiter"',
                      ),
                    data: z
                      .record(z.string(), z.unknown())
                      .describe(
                        'Block data shaped for the given type, e.g. header: { text, level }, list: { style, items }, checklist: { items: [{ text, checked }] }',
                      ),
                  })
                  .passthrough(),
              )
              .describe('The full ordered list of Editor.js blocks'),
            version: z.string().optional(),
          })
          .describe('The full Editor.js document to replace the summary with'),
      },
    },
    async ({ companyId, summary }) => {
      if (!authCtx.scopes.includes('companies:write')) {
        return missingScope('companies:write');
      }
      if (!deps?.companies) {
        return toolError('Company management is not available.');
      }

      const orgIds = await memberOrgIds();

      const existing = await prisma.company.findFirst({
        where: { id: companyId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(
          `Company with ID ${companyId} not found or not accessible.`,
        );
      }

      try {
        const company = await deps.companies.update(
          companyId,
          existing.organizationId,
          { summary },
          authCtx.userId,
          'mcp',
        );
        return json(company);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'list_contacts',
    {
      description:
        'List contacts in the organizations the authorized user belongs to. Returns up to 50 contacts, oldest first.',
      inputSchema: {
        organizationId: z
          .number()
          .optional()
          .describe('Restrict results to a specific organization'),
        search: z
          .string()
          .optional()
          .describe('Search by contact name, email, or phone'),
      },
    },
    async ({ organizationId, search }) => {
      if (!authCtx.scopes.includes('contacts:read')) {
        return missingScope('contacts:read');
      }

      const orgIds = await memberOrgIds();
      if (organizationId && !orgIds.includes(organizationId)) {
        return toolError(
          `You do not have access to organization ${organizationId}.`,
        );
      }
      if (!organizationId && orgIds.length !== 1) {
        return toolError(
          orgIds.length === 0
            ? 'User is not a member of any organization.'
            : 'User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.',
        );
      }

      const { contacts } = await deps!.contacts.findAll(
        {
          organizationId: organizationId ?? orgIds[0],
          search,
        },
        { limit: 50 },
      );

      return json(contacts);
    },
  );

  server.registerTool(
    'get_contact',
    {
      description:
        'Get detailed information about a specific contact by ID, including owners.',
      inputSchema: {
        contactId: z.int().describe('The ID of the contact to retrieve'),
      },
    },
    async ({ contactId }) => {
      if (!authCtx.scopes.includes('contacts:read')) {
        return missingScope('contacts:read');
      }

      const orgIds = await memberOrgIds();

      const contact = await prisma.contact.findFirst({
        where: { id: contactId, organizationId: { in: orgIds } },
        include: {
          owners: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      if (!contact) {
        return toolError(
          `Contact with ID ${contactId} not found or not accessible.`,
        );
      }

      return json(contact);
    },
  );

  server.registerTool(
    'create_contact',
    {
      description:
        'Create a new contact in an organization. organizationId is optional when the user belongs to exactly one organization — call list_organizations first to pick one if needed.',
      inputSchema: {
        organizationId: z
          .int()
          .optional()
          .describe(
            'Organization ID to create the contact in. Omit if you belong to exactly one organization; call list_organizations to find the correct id otherwise.',
          ),
        name: z.string().describe('The name of the contact'),
        email: z.string().optional().describe('Contact email address'),
        phone: z
          .string()
          .optional()
          .describe(
            'Contact phone number in E.164 format (e.g., +14155552671)',
          ),
        linkedinId: z
          .string()
          .optional()
          .describe('Contact LinkedIn identifier'),
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('contacts:write')) {
        return missingScope('contacts:write');
      }
      if (!deps?.contacts) {
        return toolError('Contact management is not available.');
      }

      const orgIds = await memberOrgIds();

      let resolvedOrgId = args.organizationId;
      if (resolvedOrgId === undefined) {
        if (orgIds.length === 0) {
          return toolError('User is not a member of any organization.');
        }
        if (orgIds.length > 1) {
          return toolError(
            'User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.',
          );
        }
        resolvedOrgId = orgIds[0];
      } else if (!orgIds.includes(resolvedOrgId)) {
        return toolError(
          `You do not have access to organization ${resolvedOrgId}.`,
        );
      }

      try {
        const contact = await deps.contacts.create(
          {
            organizationId: resolvedOrgId,
            name: args.name,
            email: args.email,
            phone: args.phone,
            linkedinId: args.linkedinId,
          },
          authCtx.userId,
          'mcp',
        );
        return json(contact);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'update_contact',
    {
      description:
        'Update an existing contact. Field changes are recorded on the contact activity timeline.',
      inputSchema: {
        contactId: z.int().describe('The ID of the contact to update'),
        name: z.string().optional().describe('New contact name'),
        email: z.string().optional().describe('New contact email address'),
        phone: z
          .string()
          .optional()
          .describe('New contact phone number in E.164 format'),
        linkedinId: z
          .string()
          .optional()
          .describe('New contact LinkedIn identifier'),
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('contacts:write')) {
        return missingScope('contacts:write');
      }
      if (!deps?.contacts) {
        return toolError('Contact management is not available.');
      }

      const orgIds = await memberOrgIds();

      const existing = await prisma.contact.findFirst({
        where: { id: args.contactId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(
          `Contact with ID ${args.contactId} not found or not accessible.`,
        );
      }

      try {
        const contact = await deps.contacts.update(
          args.contactId,
          existing.organizationId,
          {
            name: args.name,
            email: args.email,
            phone: args.phone,
            linkedinId: args.linkedinId,
          },
          authCtx.userId,
          'mcp',
        );
        return json(contact);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  const icpFiltersSchema = z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Apollo-style ICP filter object, e.g. { industries: string[], employeeRanges: string[], ' +
        'revenueRange: {min,max}, locations: string[], technologiesAnyOf: string[], ' +
        'personTitles: string[], personSeniorities: string[], keywords: string }. ' +
        'Omit fields that do not apply.',
    );

  server.registerTool(
    'list_icp_profiles',
    {
      description:
        'List Ideal Customer Profile (ICP) definitions for the organizations the authorized user belongs to.',
      inputSchema: {
        organizationId: z
          .int()
          .optional()
          .describe('Organization ID to list ICP profiles for'),
        page: z.int().optional().default(1),
        perPage: z.int().optional().default(20),
      },
    },
    async ({ organizationId, page, perPage }) => {
      if (!authCtx.scopes.includes('icps:read')) {
        return missingScope('icps:read');
      }
      if (!deps?.icps) {
        return toolError('ICP management is not available.');
      }

      const orgIds = await memberOrgIds();
      let resolvedOrgId = organizationId;
      if (resolvedOrgId === undefined) {
        if (orgIds.length === 0) {
          return toolError('User is not a member of any organization.');
        }
        if (orgIds.length > 1) {
          return toolError(
            'User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.',
          );
        }
        resolvedOrgId = orgIds[0];
      } else if (!orgIds.includes(resolvedOrgId)) {
        return toolError(
          `You do not have access to organization ${resolvedOrgId}.`,
        );
      }

      const result = await deps.icps.findAll(resolvedOrgId, page, perPage);
      return json(result);
    },
  );

  server.registerTool(
    'get_icp_profile',
    {
      description: 'Get a single ICP profile by ID, including its filters.',
      inputSchema: {
        icpId: z.int().describe('The ID of the ICP profile to retrieve'),
      },
    },
    async ({ icpId }) => {
      if (!authCtx.scopes.includes('icps:read')) {
        return missingScope('icps:read');
      }
      if (!deps?.icps) {
        return toolError('ICP management is not available.');
      }

      const orgIds = await memberOrgIds();
      const existing = await prisma.icpProfile.findFirst({
        where: { id: icpId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(
          `ICP profile with ID ${icpId} not found or not accessible.`,
        );
      }

      const profile = await deps.icps.findById(icpId, existing.organizationId);
      return json(profile);
    },
  );

  server.registerTool(
    'create_icp_profile',
    {
      description:
        'Create a new ICP profile. organizationId is optional when the user belongs to exactly one organization — call list_organizations first to pick one if needed.',
      inputSchema: {
        organizationId: z
          .int()
          .optional()
          .describe(
            'Organization ID to create the ICP profile in. Omit if you belong to exactly one organization; call list_organizations to find the correct id otherwise.',
          ),
        name: z.string().describe('The name of the ICP profile'),
        filters: icpFiltersSchema,
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('icps:write')) {
        return missingScope('icps:write');
      }
      if (!deps?.icps) {
        return toolError('ICP management is not available.');
      }

      const orgIds = await memberOrgIds();

      let resolvedOrgId = args.organizationId;
      if (resolvedOrgId === undefined) {
        if (orgIds.length === 0) {
          return toolError('User is not a member of any organization.');
        }
        if (orgIds.length > 1) {
          return toolError(
            'User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.',
          );
        }
        resolvedOrgId = orgIds[0];
      } else if (!orgIds.includes(resolvedOrgId)) {
        return toolError(
          `You do not have access to organization ${resolvedOrgId}.`,
        );
      }

      try {
        const profile = await deps.icps.create(resolvedOrgId, {
          name: args.name,
          filters: args.filters,
        });
        return json(profile);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'update_icp_profile',
    {
      description: 'Update an existing ICP profile.',
      inputSchema: {
        icpId: z.int().describe('The ID of the ICP profile to update'),
        name: z.string().optional().describe('New ICP profile name'),
        filters: icpFiltersSchema,
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('icps:write')) {
        return missingScope('icps:write');
      }
      if (!deps?.icps) {
        return toolError('ICP management is not available.');
      }

      const orgIds = await memberOrgIds();
      const existing = await prisma.icpProfile.findFirst({
        where: { id: args.icpId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(
          `ICP profile with ID ${args.icpId} not found or not accessible.`,
        );
      }

      try {
        const profile = await deps.icps.update(
          args.icpId,
          existing.organizationId,
          { name: args.name, filters: args.filters },
        );
        return json(profile);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'delete_icp_profile',
    {
      description: 'Delete an ICP profile.',
      inputSchema: {
        icpId: z.int().describe('The ID of the ICP profile to delete'),
      },
    },
    async ({ icpId }) => {
      if (!authCtx.scopes.includes('icps:write')) {
        return missingScope('icps:write');
      }
      if (!deps?.icps) {
        return toolError('ICP management is not available.');
      }

      const orgIds = await memberOrgIds();
      const existing = await prisma.icpProfile.findFirst({
        where: { id: icpId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(
          `ICP profile with ID ${icpId} not found or not accessible.`,
        );
      }

      try {
        await deps.icps.delete(icpId, existing.organizationId);
        return json({ deleted: true, icpId });
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'list_leads',
    {
      description:
        'List leads (people who replied to a campaign or were sourced manually) for an organization. Returns up to 50 leads, most recent first.',
      inputSchema: {
        organizationId: z
          .int()
          .optional()
          .describe('Target organization (optional if user has exactly one)'),
        search: z
          .string()
          .optional()
          .describe('Search by lead name, email, or company (optional)'),
        icpProfileId: z
          .int()
          .optional()
          .describe('Filter by ICP profile ID (optional)'),
        campaignId: z
          .int()
          .optional()
          .describe('Filter by campaign ID (optional)'),
        status: z
          .enum(['replied', 'interested', 'not_interested', 'converted'])
          .optional()
          .describe('Filter by lead status (optional)'),
        source: z
          .enum(['apollo', 'origami', 'linkedin', 'manual'])
          .optional()
          .describe('Filter by lead source (optional)'),
        page: z.int().optional().default(1),
        perPage: z.int().optional().default(50),
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('leads:read')) {
        return missingScope('leads:read');
      }
      if (!deps?.leads) {
        return toolError('Lead management is not available.');
      }

      const orgIds = await memberOrgIds();
      let resolvedOrgId = args.organizationId;
      if (resolvedOrgId === undefined) {
        if (orgIds.length === 0) {
          return toolError('User is not a member of any organization.');
        }
        if (orgIds.length > 1) {
          return toolError(
            'User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.',
          );
        }
        resolvedOrgId = orgIds[0];
      } else if (!orgIds.includes(resolvedOrgId)) {
        return toolError(
          `You do not have access to organization ${resolvedOrgId}.`,
        );
      }

      const result = await deps.leads.findAll(resolvedOrgId, {
        search: args.search,
        icpProfileId: args.icpProfileId,
        campaignId: args.campaignId,
        status: args.status,
        source: args.source,
        page: args.page,
        perPage: args.perPage,
      });
      return json(result);
    },
  );

  server.registerTool(
    'get_lead',
    {
      description: 'Get a single lead by ID.',
      inputSchema: {
        leadId: z.int().describe('The ID of the lead to retrieve'),
      },
    },
    async ({ leadId }) => {
      if (!authCtx.scopes.includes('leads:read')) {
        return missingScope('leads:read');
      }
      if (!deps?.leads) {
        return toolError('Lead management is not available.');
      }

      const orgIds = await memberOrgIds();
      const existing = await prisma.lead.findFirst({
        where: { id: leadId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(`Lead with ID ${leadId} not found or not accessible.`);
      }

      const lead = await deps.leads.findById(leadId, existing.organizationId);
      return json(lead);
    },
  );

  server.registerTool(
    'create_lead',
    {
      description:
        'Create a new lead. organizationId is optional when the user belongs to exactly one organization — call list_organizations first to pick one if needed.',
      inputSchema: {
        organizationId: z
          .int()
          .optional()
          .describe(
            'Organization ID to create the lead in. Omit if you belong to exactly one organization; call list_organizations to find the correct id otherwise.',
          ),
        icpProfileId: z
          .int()
          .describe('ICP profile this lead was sourced against'),
        name: z.string().describe('Lead name'),
        campaignId: z.int().optional().describe('Campaign ID (optional)'),
        contactId: z
          .int()
          .optional()
          .describe('Existing contact ID to link (optional)'),
        email: z.string().optional().describe('Lead email address'),
        phone: z.string().optional().describe('Lead phone number'),
        companyName: z.string().optional().describe('Lead company name'),
        title: z.string().optional().describe('Lead job title'),
        linkedinUrl: z.string().optional().describe('Lead LinkedIn URL'),
        status: z
          .enum(['replied', 'interested', 'not_interested', 'converted'])
          .optional()
          .describe('Initial status, defaults to "replied"'),
        source: z
          .enum(['apollo', 'origami', 'linkedin', 'manual'])
          .optional()
          .describe('Lead source, defaults to "manual"'),
        externalType: z
          .string()
          .optional()
          .describe('System the lead came from (apollo, salesforce, …)'),
        externalId: z
          .string()
          .optional()
          .describe("Identity within externalType's system"),
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('leads:write')) {
        return missingScope('leads:write');
      }
      if (!deps?.leads) {
        return toolError('Lead management is not available.');
      }

      const orgIds = await memberOrgIds();

      let resolvedOrgId = args.organizationId;
      if (resolvedOrgId === undefined) {
        if (orgIds.length === 0) {
          return toolError('User is not a member of any organization.');
        }
        if (orgIds.length > 1) {
          return toolError(
            'User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.',
          );
        }
        resolvedOrgId = orgIds[0];
      } else if (!orgIds.includes(resolvedOrgId)) {
        return toolError(
          `You do not have access to organization ${resolvedOrgId}.`,
        );
      }

      try {
        const { organizationId: _omit, ...dto } = args;
        const lead = await deps.leads.create(resolvedOrgId, dto);
        return json(lead);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'update_lead',
    {
      description: 'Update an existing lead.',
      inputSchema: {
        leadId: z.int().describe('The ID of the lead to update'),
        name: z.string().optional().describe('New lead name'),
        email: z.string().optional().describe('New lead email address'),
        phone: z.string().optional().describe('New lead phone number'),
        companyName: z.string().optional().describe('New lead company name'),
        title: z.string().optional().describe('New lead job title'),
        linkedinUrl: z.string().optional().describe('New lead LinkedIn URL'),
        status: z
          .enum(['replied', 'interested', 'not_interested', 'converted'])
          .optional()
          .describe('New lead status'),
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('leads:write')) {
        return missingScope('leads:write');
      }
      if (!deps?.leads) {
        return toolError('Lead management is not available.');
      }

      const orgIds = await memberOrgIds();
      const existing = await prisma.lead.findFirst({
        where: { id: args.leadId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(
          `Lead with ID ${args.leadId} not found or not accessible.`,
        );
      }

      try {
        const lead = await deps.leads.update(
          args.leadId,
          existing.organizationId,
          {
            name: args.name,
            email: args.email,
            phone: args.phone,
            companyName: args.companyName,
            title: args.title,
            linkedinUrl: args.linkedinUrl,
            status: args.status,
          },
        );
        return json(lead);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'delete_lead',
    {
      description: 'Delete a lead.',
      inputSchema: {
        leadId: z.int().describe('The ID of the lead to delete'),
      },
    },
    async ({ leadId }) => {
      if (!authCtx.scopes.includes('leads:write')) {
        return missingScope('leads:write');
      }
      if (!deps?.leads) {
        return toolError('Lead management is not available.');
      }

      const orgIds = await memberOrgIds();
      const existing = await prisma.lead.findFirst({
        where: { id: leadId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(`Lead with ID ${leadId} not found or not accessible.`);
      }

      try {
        await deps.leads.delete(leadId, existing.organizationId);
        return json({ deleted: true, leadId });
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'convert_lead',
    {
      description:
        'Convert a lead into a deal (and upserts a linked contact/company). Recorded via the same flow as the REST API.',
      inputSchema: {
        leadId: z.int().describe('The ID of the lead to convert'),
      },
    },
    async ({ leadId }) => {
      if (!authCtx.scopes.includes('leads:write')) {
        return missingScope('leads:write');
      }
      if (!deps?.leads) {
        return toolError('Lead management is not available.');
      }

      const orgIds = await memberOrgIds();
      const existing = await prisma.lead.findFirst({
        where: { id: leadId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(`Lead with ID ${leadId} not found or not accessible.`);
      }

      try {
        const result = await deps.leads.convert(
          leadId,
          existing.organizationId,
        );
        return json(result);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'revert_lead',
    {
      description:
        'Revert a converted lead back to "replied" status, deleting the deal that was created for it.',
      inputSchema: {
        leadId: z.int().describe('The ID of the lead to revert'),
      },
    },
    async ({ leadId }) => {
      if (!authCtx.scopes.includes('leads:write')) {
        return missingScope('leads:write');
      }
      if (!deps?.leads) {
        return toolError('Lead management is not available.');
      }

      const orgIds = await memberOrgIds();
      const existing = await prisma.lead.findFirst({
        where: { id: leadId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(`Lead with ID ${leadId} not found or not accessible.`);
      }

      try {
        const result = await deps.leads.revert(leadId, existing.organizationId);
        return json(result);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'list_campaigns',
    {
      description:
        'List outreach campaigns (Apollo sequences tracked in Zuko) for an organization, optionally filtered by ICP profile.',
      inputSchema: {
        organizationId: z
          .int()
          .optional()
          .describe('Target organization (optional if user has exactly one)'),
        icpProfileId: z
          .int()
          .optional()
          .describe('Restrict to campaigns linked to this ICP profile'),
      },
    },
    async ({ organizationId, icpProfileId }) => {
      if (!authCtx.scopes.includes('campaigns:read')) {
        return missingScope('campaigns:read');
      }
      if (!deps?.campaigns) {
        return toolError('Campaign management is not available.');
      }

      const orgIds = await memberOrgIds();
      let resolvedOrgId = organizationId;
      if (resolvedOrgId === undefined) {
        if (orgIds.length === 0) {
          return toolError('User is not a member of any organization.');
        }
        if (orgIds.length > 1) {
          return toolError(
            'User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.',
          );
        }
        resolvedOrgId = orgIds[0];
      } else if (!orgIds.includes(resolvedOrgId)) {
        return toolError(
          `You do not have access to organization ${resolvedOrgId}.`,
        );
      }

      const campaigns = icpProfileId
        ? await deps.campaigns.getCampaignsByIcpProfile(
            resolvedOrgId,
            icpProfileId,
          )
        : await deps.campaigns.getAllCampaigns(resolvedOrgId);
      return json(campaigns);
    },
  );

  server.registerTool(
    'get_campaign',
    {
      description: 'Get a single campaign by its Zuko database ID.',
      inputSchema: {
        campaignId: z.int().describe('The ID of the campaign to retrieve'),
      },
    },
    async ({ campaignId }) => {
      if (!authCtx.scopes.includes('campaigns:read')) {
        return missingScope('campaigns:read');
      }
      if (!deps?.campaigns) {
        return toolError('Campaign management is not available.');
      }

      const orgIds = await memberOrgIds();
      const existing = await prisma.campaign.findFirst({
        where: { id: campaignId, organizationId: { in: orgIds } },
        select: { organizationId: true },
      });
      if (!existing) {
        return toolError(
          `Campaign with ID ${campaignId} not found or not accessible.`,
        );
      }

      try {
        const campaign = await deps.campaigns.getZukoCampaignById(
          existing.organizationId,
          campaignId,
        );
        return json(campaign);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'create_campaign',
    {
      description:
        'Create a campaign record by name (and optional ICP profile link). This only creates the ' +
        'Zuko-side metadata row — it does not create or activate an Apollo sequence. Use the web ' +
        'UI or Apollo sequence tools to build and launch the actual outreach sequence afterward. ' +
        'organizationId is optional when the user belongs to exactly one organization.',
      inputSchema: {
        organizationId: z
          .int()
          .optional()
          .describe(
            'Organization ID to create the campaign in. Omit if you belong to exactly one organization; call list_organizations to find the correct id otherwise.',
          ),
        name: z.string().describe('Campaign name'),
        icpProfileId: z
          .int()
          .optional()
          .describe('ICP profile to link this campaign to (optional)'),
      },
    },
    async (args) => {
      if (!authCtx.scopes.includes('campaigns:write')) {
        return missingScope('campaigns:write');
      }
      if (!deps?.campaigns) {
        return toolError('Campaign management is not available.');
      }

      const orgIds = await memberOrgIds();

      let resolvedOrgId = args.organizationId;
      if (resolvedOrgId === undefined) {
        if (orgIds.length === 0) {
          return toolError('User is not a member of any organization.');
        }
        if (orgIds.length > 1) {
          return toolError(
            'User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.',
          );
        }
        resolvedOrgId = orgIds[0];
      } else if (!orgIds.includes(resolvedOrgId)) {
        return toolError(
          `You do not have access to organization ${resolvedOrgId}.`,
        );
      }

      try {
        const campaign = await deps.campaigns.createCampaignMeta(
          resolvedOrgId,
          authCtx.userId,
          { name: args.name, icpProfileId: args.icpProfileId },
        );
        return json(campaign);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  const commentEntityType = z.enum(COMMENT_ENTITY_TYPES);

  server.registerTool(
    'add_comment',
    {
      description:
        'Add a comment to a task, deal, company, or contact. The comment appears on that ' +
        "entity's activity timeline, attributed to the authorized user.",
      inputSchema: {
        entityType: commentEntityType.describe(
          'The type of entity to comment on',
        ),
        entityId: z.int().describe('The ID of the entity to comment on'),
        content: z.string().describe('The comment text'),
      },
    },
    async ({ entityType, entityId, content }) => {
      if (!authCtx.scopes.includes('comments:write')) {
        return missingScope('comments:write');
      }
      if (!deps?.activity) {
        return toolError('Comments are not available.');
      }

      const orgIds = await memberOrgIds();
      const entityOrgId = await resolveEntityOrgId(
        prisma,
        entityType,
        entityId,
      );
      if (!entityOrgId || !orgIds.includes(entityOrgId)) {
        return toolError(
          `${entityType} with ID ${entityId} not found or not accessible.`,
        );
      }

      try {
        const comment = await deps.activity.createComment(
          entityType,
          entityId,
          authCtx.userId,
          content,
        );
        return json(comment);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'list_comments',
    {
      description:
        'List comments on a task, deal, company, or contact, most recent first.',
      inputSchema: {
        entityType: commentEntityType.describe(
          'The type of entity to list comments for',
        ),
        entityId: z.int().describe('The ID of the entity'),
        limit: z
          .int()
          .optional()
          .describe('Max comments to return (default 50)'),
      },
    },
    async ({ entityType, entityId, limit }) => {
      if (!authCtx.scopes.includes('comments:read')) {
        return missingScope('comments:read');
      }
      if (!deps?.activity) {
        return toolError('Comments are not available.');
      }

      const orgIds = await memberOrgIds();
      const entityOrgId = await resolveEntityOrgId(
        prisma,
        entityType,
        entityId,
      );
      if (!entityOrgId || !orgIds.includes(entityOrgId)) {
        return toolError(
          `${entityType} with ID ${entityId} not found or not accessible.`,
        );
      }

      const result = await deps.activity.findAll(
        { entityType, entityId, activityType: 'comment' },
        { limit: limit ?? 50 },
      );
      return json(result);
    },
  );

  server.registerTool(
    'update_comment',
    {
      description:
        'Edit an existing comment. Only the comment you authored can be edited.',
      inputSchema: {
        commentId: z.int().describe('The ID of the comment to update'),
        content: z.string().describe('The new comment text'),
      },
    },
    async ({ commentId, content }) => {
      if (!authCtx.scopes.includes('comments:write')) {
        return missingScope('comments:write');
      }
      if (!deps?.activity) {
        return toolError('Comments are not available.');
      }

      try {
        const existing = await deps.activity.findById(commentId);
        const orgIds = await memberOrgIds();
        const entityOrgId = await resolveEntityOrgId(
          prisma,
          existing.entityType as (typeof COMMENT_ENTITY_TYPES)[number],
          existing.entityId,
        );
        if (!entityOrgId || !orgIds.includes(entityOrgId)) {
          return toolError(
            `Comment with ID ${commentId} not found or not accessible.`,
          );
        }

        const updated = await deps.activity.update(
          commentId,
          authCtx.userId,
          content,
        );
        return json(updated);
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  server.registerTool(
    'delete_comment',
    {
      description:
        'Delete an existing comment. Only the comment you authored can be deleted.',
      inputSchema: {
        commentId: z.int().describe('The ID of the comment to delete'),
      },
    },
    async ({ commentId }) => {
      if (!authCtx.scopes.includes('comments:write')) {
        return missingScope('comments:write');
      }
      if (!deps?.activity) {
        return toolError('Comments are not available.');
      }

      try {
        const existing = await deps.activity.findById(commentId);
        const orgIds = await memberOrgIds();
        const entityOrgId = await resolveEntityOrgId(
          prisma,
          existing.entityType as (typeof COMMENT_ENTITY_TYPES)[number],
          existing.entityId,
        );
        if (!entityOrgId || !orgIds.includes(entityOrgId)) {
          return toolError(
            `Comment with ID ${commentId} not found or not accessible.`,
          );
        }

        await deps.activity.delete(commentId, authCtx.userId);
        return json({ deleted: true, commentId });
      } catch (error: unknown) {
        return toolError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  );

  // ---- Prospects ----

  /**
   * Org resolution shared by the prospect tools: an explicit id must be one
   * the user belongs to; otherwise it is inferred only when unambiguous.
   */
  const resolveProspectOrg = async (
    organizationId?: number,
  ): Promise<{ orgId: number } | { error: ToolResult }> => {
    const orgIds = await memberOrgIds();
    if (organizationId === undefined) {
      if (orgIds.length === 0) {
        return {
          error: toolError('User is not a member of any organization.'),
        };
      }
      if (orgIds.length > 1) {
        return {
          error: toolError(
            'User belongs to multiple organizations. Call list_organizations to find the correct id, then pass it as organizationId.',
          ),
        };
      }
      return { orgId: orgIds[0] };
    }
    if (!orgIds.includes(organizationId)) {
      return {
        error: toolError(
          `You do not have access to organization ${organizationId}.`,
        ),
      };
    }
    return { orgId: organizationId };
  };

  /** Runs a prospect tool body, turning service validation into tool errors. */
  const prospectTool = async (
    scope: 'prospects:read' | 'prospects:write',
    organizationId: number | undefined,
    run: (orgId: number, prospects: ProspectsService) => Promise<unknown>,
  ): Promise<ToolResult> => {
    if (!authCtx.scopes.includes(scope)) return missingScope(scope);
    if (!deps?.prospects) {
      return toolError('Prospect management is not available.');
    }

    const resolved = await resolveProspectOrg(organizationId);
    if ('error' in resolved) return resolved.error;

    try {
      return json(await run(resolved.orgId, deps.prospects));
    } catch (error: unknown) {
      return toolError(error instanceof Error ? error.message : String(error));
    }
  };

  server.registerTool(
    'list_prospects',
    {
      description:
        'List prospects (people targeted by outbound, before they become leads) for an organization. Filter by lifecycle status, campaign, ICP profile, or engagement state.',
      inputSchema: {
        organizationId: z
          .int()
          .optional()
          .describe('Target organization (optional if user has exactly one)'),
        search: z
          .string()
          .optional()
          .describe('Search by name, email, or company (optional)'),
        status: mcpEnum(PROSPECT_STATUS_VALUES)
          .optional()
          .describe('Filter by prospect lifecycle status (optional)'),
        engagement: mcpEnum(ENGAGEMENT_STATE_VALUES)
          .optional()
          .describe('Filter by campaign engagement state (optional)'),
        campaignId: z
          .int()
          .optional()
          .describe('Only prospects with a membership in this campaign'),
        icpProfileId: z.int().optional().describe('Filter by ICP profile ID'),
        page: z.int().optional().default(1),
        perPage: z.int().optional().default(50),
      },
    },
    async (args) =>
      prospectTool('prospects:read', args.organizationId, (orgId, prospects) =>
        prospects.findAll(
          orgId,
          {
            search: args.search,
            icpProfileId: args.icpProfileId,
            campaignId: args.campaignId,
            ...(args.status ? { status: [args.status] } : {}),
            ...(args.engagement ? { engagement: [args.engagement] } : {}),
          },
          args.page,
          args.perPage,
        ),
      ),
  );

  server.registerTool(
    'get_prospect',
    {
      description:
        'Get one prospect with its campaign memberships, per-channel consent, and linked CRM contact or lead.',
      inputSchema: {
        prospectId: z.int().describe('The ID of the prospect to retrieve'),
        organizationId: z.int().optional(),
      },
    },
    async (args) =>
      prospectTool('prospects:read', args.organizationId, (orgId, prospects) =>
        prospects.findById(args.prospectId, orgId),
      ),
  );

  server.registerTool(
    'get_prospect_events',
    {
      description:
        'Campaign event history for a prospect, most recent first. Events are the immutable record of what happened; prospect and membership states are derived from them.',
      inputSchema: {
        prospectId: z.int(),
        organizationId: z.int().optional(),
        limit: z.int().optional().default(100),
      },
    },
    async (args) =>
      prospectTool(
        'prospects:read',
        args.organizationId,
        async (orgId, prospects) => {
          await prospects.findById(args.prospectId, orgId);
          return prospects.findEvents(args.prospectId, args.limit);
        },
      ),
  );

  server.registerTool(
    'create_prospect',
    {
      description:
        'Create a prospect. Identity is resolved first against existing prospects and CRM contacts (by Apollo person id, then email, then LinkedIn URL), so a person we already hold is enriched or linked rather than duplicated.',
      inputSchema: {
        name: z.string().describe('Full name of the person'),
        organizationId: z.int().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        companyName: z.string().optional(),
        title: z.string().optional(),
        linkedinUrl: z.string().optional(),
        externalType: z
          .string()
          .optional()
          .describe(
            'System this prospect came from (apollo, origami, salesforce, …). Pass with externalId so the pair can be matched.',
          ),
        externalId: z
          .string()
          .optional()
          .describe("Identity within externalType's system"),
        icpProfileId: z.int().optional(),
        source: z
          .string()
          .optional()
          .describe('Where the prospect came from, defaults to "manual"'),
      },
    },
    async (args) =>
      prospectTool(
        'prospects:write',
        args.organizationId,
        (orgId, prospects) => {
          const { organizationId: _ignored, ...input } = args;
          return prospects.create(orgId, input);
        },
      ),
  );

  server.registerTool(
    'enrol_prospect',
    {
      description:
        'Enrol a prospect in a campaign. Refuses when the prospect is engaged, promoted, disqualified or suppressed, when it already has an open membership in that campaign, or when no contactable channel remains.',
      inputSchema: {
        prospectId: z.int(),
        campaignId: z.int(),
        organizationId: z.int().optional(),
        channel: mcpEnum(CONTACT_CHANNEL_VALUES)
          .optional()
          .describe('Channel the campaign will use, defaults to email'),
      },
    },
    async (args) =>
      prospectTool('prospects:write', args.organizationId, (orgId, prospects) =>
        // An agent never overrides the safeguards: no `force` is exposed.
        prospects.enrol(args.prospectId, orgId, args.campaignId, {
          channel: args.channel,
          actor: { userId: authCtx.userId, source: 'agent' },
        }),
      ),
  );

  server.registerTool(
    'record_campaign_event',
    {
      description:
        'Append a campaign event to a membership and let the derived states follow. Pass externalId for provider events so replays stay idempotent. Opens and clicks are recorded but deliberately change no state — only a reply does.',
      inputSchema: {
        membershipId: z
          .int()
          .describe('Campaign membership id (from get_prospect)'),
        eventType: mcpEnum(CAMPAIGN_EVENT_VALUES),
        organizationId: z.int().optional(),
        externalId: z
          .string()
          .optional()
          .describe('Provider event id, for idempotent replay'),
      },
    },
    async (args) =>
      prospectTool('prospects:write', args.organizationId, (orgId, prospects) =>
        prospects.recordEvent(
          args.membershipId,
          orgId,
          args.eventType,
          undefined,
          args.externalId,
          undefined,
          { userId: authCtx.userId, source: 'agent' },
        ),
      ),
  );

  server.registerTool(
    'set_prospect_disposition',
    {
      description:
        'Conclude a campaign membership. The disposition settles the prospect’s standing: interested makes it engaged, nurture returns it to the pool, disqualified rules it out, opted_out suppresses it.',
      inputSchema: {
        membershipId: z.int(),
        disposition: mcpEnum(CAMPAIGN_DISPOSITION_VALUES),
        organizationId: z.int().optional(),
      },
    },
    async (args) =>
      prospectTool('prospects:write', args.organizationId, (orgId, prospects) =>
        prospects.setDisposition(args.membershipId, orgId, args.disposition, {
          actor: { userId: authCtx.userId, source: 'agent' },
        }),
      ),
  );

  server.registerTool(
    'set_prospect_status',
    {
      description:
        'Apply a prospect lifecycle status transition. Invalid moves are refused. Leaving "suppressed" or "disqualified" requires an explicit human action and cannot be done by an agent.',
      inputSchema: {
        prospectId: z.int(),
        status: mcpEnum(PROSPECT_STATUS_VALUES),
        organizationId: z.int().optional(),
      },
    },
    async (args) =>
      prospectTool('prospects:write', args.organizationId, (orgId, prospects) =>
        // manual is deliberately not exposed: an agent is not a human action.
        prospects.setStatus(args.prospectId, orgId, args.status),
      ),
  );

  server.registerTool(
    'log_prospect_outreach',
    {
      description:
        'Log a touch made outside any campaign — a phone call, a one-off email, a LinkedIn message. No campaign or provider sequence is needed. Refuses outbound touches on a channel whose consent was revoked.',
      inputSchema: {
        prospectId: z.int(),
        eventType: mcpEnum(CAMPAIGN_EVENT_VALUES),
        channel: mcpEnum(CONTACT_CHANNEL_VALUES),
        organizationId: z.int().optional(),
      },
    },
    async (args) =>
      prospectTool('prospects:write', args.organizationId, (orgId, prospects) =>
        prospects.recordDirectOutreach(
          args.prospectId,
          orgId,
          args.eventType,
          args.channel,
          { userId: authCtx.userId, source: 'agent' },
        ),
      ),
  );

  server.registerTool(
    'promote_prospect',
    {
      description:
        'Promote an engaged prospect to a lead. Creates the lead, closes every open campaign membership so automation stops, and marks the prospect promoted. Only an engaged prospect can be promoted.',
      inputSchema: {
        prospectId: z.int(),
        organizationId: z.int().optional(),
      },
    },
    async (args) =>
      prospectTool('prospects:write', args.organizationId, (orgId, prospects) =>
        prospects.promote(args.prospectId, orgId),
      ),
  );

  server.registerTool(
    'suppress_prospect',
    {
      description:
        'Stop contacting a prospect. With a channel, revokes consent for that channel only; without one, suppresses the prospect outright and closes every open membership.',
      inputSchema: {
        prospectId: z.int(),
        organizationId: z.int().optional(),
        channel: mcpEnum(CONTACT_CHANNEL_VALUES)
          .optional()
          .describe('Revoke just this channel; omit to suppress entirely'),
      },
    },
    async (args) =>
      prospectTool('prospects:write', args.organizationId, (orgId, prospects) =>
        args.channel
          ? prospects.setConsent(
              args.prospectId,
              orgId,
              args.channel,
              'revoked',
            )
          : prospects.suppress(args.prospectId, orgId),
      ),
  );

  return server;
}
