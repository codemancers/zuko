import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { DealsService } from '@zuko/sales';
import { getContextEntities } from '../context/tool-context';

/**
 * LangChain tool for retrieving full deal information.
 * When contextEntities are available from graph state (second argument),
 * a single deal in context is used so the model does not need to guess the ID.
 */
export function createGetDealDetailsTool(dealsService: DealsService) {
  return tool(
    async (input = {}, config?: unknown) => {
      const contextEntities = getContextEntities(config);
      const contextDeals =
        contextEntities?.filter((e) => e.type === 'deal') ?? [];

      if (contextDeals.length > 1) {
        const ids = contextDeals.map((d) => d.id);
        return {
          useQueryToolInstead: true,
          message: `Multiple deals in context (${contextDeals.length}). Use query_deals with filters: { dealIds: [${ids.join(', ')}] } to fetch all of them in one call.`,
          dealIds: ids,
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

      try {
        const deal = await dealsService.findById(dealId);
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
          owners?: Array<{ user: { id: number; name: string | null; email: string | null } }>;
          companies?: Array<{ company: { id: number; companyName: string; website?: string | null } }>;
          contacts?: Array<{ contact: { id: number; name: string; email?: string | null } }>;
          createdAt: Date;
          updatedAt: Date;
        };

        return {
          id: d.id,
          title: d.title,
          value: d.value ?? null,
          currency: d.currency ?? null,
          stage: d.stage ?? null,
          summary: d.summary ?? null,
          probability: d.probability ?? null,
          expectedCloseDate: d.expectedCloseDate?.toISOString() ?? null,
          actualCloseDate: d.actualCloseDate?.toISOString() ?? null,
          owners: (d.owners ?? []).map((o) => ({
            id: o.user.id,
            name: o.user.name,
            email: o.user.email,
          })),
          companies: (d.companies ?? []).map((c) => ({
            id: c.company.id,
            companyName: c.company.companyName,
            website: c.company.website,
          })),
          contacts: (d.contacts ?? []).map((c) => ({
            id: c.contact.id,
            name: c.contact.name,
            email: c.contact.email,
          })),
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return {
            error: `Deal with ID ${dealId} not found`,
          };
        }
        throw error;
      }
    },
    {
      name: 'get_deal_details',
      description: `Get full details for a single deal. ID is optional: when omitted, uses the single deal from context (contextEntities). Call this whenever the user asks for deal details.

- One deal in context: call with no arguments.
- User provided an ID: you may pass dealId.
- Multiple deals in context: use query_deals with filters.dealIds instead.

Returns: Deal object with id, title, value, currency, stage, summary, probability, expectedCloseDate, actualCloseDate, owners, companies, contacts, createdAt, updatedAt`,
      schema: z.object({
        dealId: z
          .number()
          .describe('Optional. Deal ID; when omitted, tool uses context.')
          .optional(),
      }),
    },
  );
}
