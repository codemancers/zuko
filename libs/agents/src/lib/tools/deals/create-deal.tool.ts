import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { DealsService } from '@zuko/sales';
import { getOrganizationId, getUserId } from '../context/tool-context';

function parseOptionalDate(value: string | undefined): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * LangChain tool for creating a deal from chat.
 *
 * Chat-specific requirements (per product spec):
 * - title (deal name) is the only mandatory field
 * - owner defaults to the authenticated user (state.userId) unless explicitly provided
 */
export function createCreateDealTool(dealsService: DealsService) {
  return tool(
    async (input, config?: unknown) => {
      const organizationId = getOrganizationId(config);
      if (organizationId === undefined) {
        return {
          error:
            'No organization context. Please select an organization and try again.',
        };
      }

      const userId = getUserId(config);

      const payload = input as {
        title: string;
        value?: number;
        currency?: string;
        probability?: number;
        stage?: string;
        summary?: string;
        expectedCloseDate?: string;
        source?: string;
        priority?: number;
        ownerIds?: number[];
        primaryOwnerId?: number;
      };

      const ownerIds =
        payload.ownerIds && payload.ownerIds.length > 0
          ? payload.ownerIds
          : userId !== undefined
            ? [userId]
            : [];

      if (ownerIds.length === 0) {
        return {
          error:
            'No owner available. Provide ownerIds or ensure userId is present in context.',
        };
      }

      const expectedCloseDate = parseOptionalDate(payload.expectedCloseDate);

      try {
        const deal = await dealsService.create({
          organizationId,
          title: payload.title,
          value: payload.value,
          currency: payload.currency,
          probability: payload.probability,
          stage: payload.stage,
          summary: payload.summary,
          expectedCloseDate,
          source: payload.source,
          priority: payload.priority,
          ownerIds,
          primaryOwnerId: payload.primaryOwnerId,
        });

        const d = deal as {
          id: number;
          title: string;
          value?: number | null;
          currency?: string | null;
          stage?: string | null;
          summary?: string | null;
          probability?: number | null;
          expectedCloseDate?: Date | null;
          createdAt: Date;
          updatedAt: Date;
          owners?: Array<{
            isPrimary: boolean;
            assignedAt: Date;
            user: { id: number; name: string; email: string };
          }>;
        };

        return {
          success: true,
          message: 'Deal created.',
          deal: {
            id: d.id,
            title: d.title,
            value: d.value ?? null,
            currency: d.currency ?? null,
            stage: d.stage ?? null,
            summary: d.summary ?? null,
            probability: d.probability ?? null,
            expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
            owners: (d.owners ?? []).map((o) => ({
              id: o.user.id,
              name: o.user.name,
              email: o.user.email,
              isPrimary: o.isPrimary,
              assignedAt: o.assignedAt.toISOString(),
            })),
            createdAt: d.createdAt.toISOString(),
            updatedAt: d.updatedAt.toISOString(),
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      name: 'create_deal',
      description: `Create a new deal from chat. Use when the user says "create a deal" or "add a deal".

Chat requirements:
- title is required (deal name)
- ownerIds defaults to the authenticated user (state.userId) if omitted

Optional: value, currency, probability, stage, summary, expectedCloseDate, source, priority.
Returns: { success, message, deal } on success; { error } on failure.`,
      schema: z.object({
        title: z
          .string()
          .min(1)
          .describe('Deal title / name (required)'),
        value: z.number().optional().describe('Deal value (number)'),
        currency: z.string().optional().describe('Currency code e.g. USD'),
        probability: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe('Probability percentage 0-100'),
        stage: z
          .string()
          .optional()
          .describe(
            'Deal stage e.g. lead, qualified, proposal, negotiation, closed_won, closed_lost',
          ),
        summary: z.string().optional().describe('Deal summary'),
        expectedCloseDate: z
          .string()
          .optional()
          .describe('Expected close date (ISO date string)'),
        source: z.string().optional().describe('Deal source'),
        priority: z
          .number()
          .min(0)
          .max(4)
          .optional()
          .describe('Priority 0-4'),
        ownerIds: z
          .array(z.number())
          .optional()
          .describe(
            'Optional. Owner user IDs. When omitted, defaults to current user.',
          ),
        primaryOwnerId: z
          .number()
          .optional()
          .describe('Optional. Primary owner user ID (must be in ownerIds).'),
      }),
    },
  );
}
