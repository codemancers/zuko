import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Prisma, type TaskStatus } from '@prisma/client';
import type { PrismaClient } from '@zuko/models';
import { z } from 'zod';

export interface McpAuthContext {
  userId: number;
  scopes: string[];
}

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

  return server;
}
