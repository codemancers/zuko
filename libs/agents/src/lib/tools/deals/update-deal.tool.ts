import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { DealsService } from '@zuko/sales';
import {
  getContextEntities,
  getOrganizationId,
} from '../context/tool-context';

function parseOptionalDate(value: string | undefined): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * LangChain tool for updating a deal.
 * When contextEntities are available, a single deal in context is used when dealId is omitted.
 * Pass only the fields to update; the backend applies them and returns the updated deal for confirmation.
 */
export function createUpdateDealTool(dealsService: DealsService) {
  return tool(
    async (input = {}, config?: unknown) => {
      const contextEntities = getContextEntities(config);
      const contextDeals =
        contextEntities?.filter((e) => e.type === 'deal') ?? [];

      if (contextDeals.length > 1) {
        return {
          error: `Multiple deals in context (${contextDeals.length}). Pass dealId to specify which deal to update.`,
        };
      }

      const dealFromContext =
        contextDeals.length === 1 ? contextDeals[0] : undefined;
      const dealId =
        (input as { dealId?: number }).dealId ?? dealFromContext?.id;

      if (dealId === undefined) {
        return {
          error:
            'No deal in context and no dealId provided. Add a deal via the + button or provide dealId.',
        };
      }

      const payload = input as {
        title?: string;
        value?: number;
        currency?: string;
        probability?: number;
        stage?: string;
        summary?: string;
        expectedCloseDate?: string;
        actualCloseDate?: string;
        lostReason?: string;
        source?: string;
        priority?: number;
      };
      const updates: Record<string, unknown> = {};
      if (payload.title !== undefined) updates.title = payload.title;
      if (payload.value !== undefined) updates.value = payload.value;
      if (payload.currency !== undefined) updates.currency = payload.currency;
      if (payload.probability !== undefined)
        updates.probability = payload.probability;
      if (payload.stage !== undefined) updates.stage = payload.stage;
      if (payload.summary !== undefined) updates.summary = payload.summary;
      if (payload.expectedCloseDate !== undefined) {
        const d = parseOptionalDate(payload.expectedCloseDate);
        if (d) updates.expectedCloseDate = d;
      }
      if (payload.actualCloseDate !== undefined) {
        const d = parseOptionalDate(payload.actualCloseDate);
        if (d) updates.actualCloseDate = d;
      }
      if (payload.lostReason !== undefined)
        updates.lostReason = payload.lostReason;
      if (payload.source !== undefined) updates.source = payload.source;
      if (payload.priority !== undefined) updates.priority = payload.priority;

      if (Object.keys(updates).length === 0) {
        return {
          error:
            'Provide at least one field to update: title, value, currency, probability, stage, summary, expectedCloseDate, actualCloseDate, lostReason, source, or priority.',
        };
      }

      const organizationId = getOrganizationId(config);
      if (organizationId === undefined) {
        return {
          error:
            'No organization context. Please select an organization and try again.',
        };
      }

      try {
        const deal = await dealsService.update(
          dealId,
          organizationId,
          updates as any,
        );
        const d = deal as {
          id: number;
          title: string;
          value?: number | null;
          currency?: string | null;
          stage?: string | null;
          summary?: string | null;
          probability?: number | null;
          expectedCloseDate?: Date | null;
          actualCloseDate?: Date | null;
          lostReason?: string | null;
          updatedAt: Date;
        };
        return {
          success: true,
          message: 'Deal updated.',
          deal: {
            id: d.id,
            title: d.title,
            value: d.value ?? null,
            currency: d.currency ?? null,
            stage: d.stage ?? null,
            summary: d.summary ?? null,
            probability: d.probability ?? null,
            expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
            actualCloseDate: d.actualCloseDate?.toISOString() ?? null,
            lostReason: d.lostReason ?? null,
            updatedAt: d.updatedAt.toISOString(),
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return { error: `Deal with ID ${dealId} not found` };
          }
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      name: 'update_deal',
      description: `Update a deal's details. Use when the user says something like "change deal status to closed", "update the deal value to 5000", "set the stage to negotiation", "mark this deal as closed". ID is optional: when omitted, uses the single deal from context (contextEntities). Pass only the fields you want to change. stage can be e.g. "lead", "qualified", "proposal", "negotiation", "closed_won", "closed_lost". Returns the updated deal for confirmation.`,
      schema: z.object({
        dealId: z
          .number()
          .describe(
            'Optional. Deal ID; when omitted, uses the single deal from context.',
          )
          .optional(),
        title: z.string().describe('Deal title').optional(),
        value: z.number().describe('Deal value (number)').optional(),
        currency: z.string().describe('Currency code e.g. USD').optional(),
        probability: z
          .number()
          .min(0)
          .max(100)
          .describe('Probability percentage 0-100')
          .optional(),
        stage: z
          .string()
          .describe(
            'Deal stage e.g. lead, qualified, proposal, negotiation, closed_won, closed_lost',
          )
          .optional(),
        summary: z.string().describe('Deal summary').optional(),
        expectedCloseDate: z
          .string()
          .describe('Expected close date (ISO date string)')
          .optional(),
        actualCloseDate: z
          .string()
          .describe('Actual close date (ISO date string)')
          .optional(),
        lostReason: z.string().describe('Reason if deal was lost').optional(),
        source: z.string().describe('Deal source').optional(),
        priority: z
          .number()
          .min(0)
          .max(4)
          .describe('Priority 0-4')
          .optional(),
      }),
    },
  );
}
