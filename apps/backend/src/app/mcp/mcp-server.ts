import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Prisma, type TaskStatus } from '@prisma/client';
import type { PrismaClient } from '@zuko/models';
import type { DealsService } from '@zuko/sales';
import { DEAL_STAGE_VALUES } from '@zuko/sales';
import { z } from 'zod';

export interface McpAuthContext {
  userId: number;
  scopes: string[];
}

/**
 * Optional NestJS services the controller wires in. Deal writes go through
 * DealsService so they run the same validation and emit the same activity-feed
 * events as the REST API; deal reads stay on prisma for full control of
 * ordering and org scoping.
 */
export interface McpDeps {
  deals: DealsService;
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

  return server;
}
