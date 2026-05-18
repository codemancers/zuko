import { tool } from 'langchain';
import { Backend } from '../shared/backend';
import { z } from 'zod';
import {
  type ToolRunConfig,
  getOrganizationId,
  getContextEntities,
  getUserId,
  getSignJwt,
} from './context.tools';

function orgHeader(organisationId: number | undefined): string {
  return organisationId != null ? String(organisationId) : '';
}

export const getDealDetailsTool = tool(
  async (input: { dealId?: number }, config: ToolRunConfig) => {
    const organisationId = getOrganizationId(config);
    const signJwt = getSignJwt(config);
    const contextEntities = getContextEntities(config);
    const contextDeals =
      contextEntities?.filter((e) => e.type === 'deal') ?? [];

    if (contextDeals.length > 1) {
      const ids = contextDeals.map((d) => d.id);
      return {
        useQueryToolInstead: true,
        message: `Multiple deals in context. Use query_deals with filters.dealIds: [${ids.join(', ')}]`,
        dealIds: ids,
      };
    }

    const dealFromContext =
      contextDeals.length === 1 ? contextDeals[0] : undefined;
    const dealId = input.dealId ?? dealFromContext?.id;

    if (dealId === undefined) {
      return {
        error:
          'No deal in context and no dealId provided. Add a deal or provide dealId.',
      };
    }
    if (!organisationId) {
      return { error: 'User context (organisationId) is required' };
    }

    const result = await Backend(`/deals/${dealId}`, {
      method: 'GET',
      organisationId: orgHeader(organisationId),
      signJwt,
    });
    if (!result.success || !result.data) {
      return {
        error: result.error ?? 'Failed to fetch deal',
        deal: null,
      };
    }
    return {
      success: true,
      message: 'Deal fetched successfully',
      deal: result.data,
    };
  },
  {
    name: 'get_deal_details',
    description:
      'Get full details for a deal. ID is optional; when omitted, uses the single deal from context. Returns: id, title, value, currency, stage, summary, probability, expectedCloseDate, actualCloseDate, owners, companies, contacts, createdAt, updatedAt.',
    schema: z.object({
      dealId: z.number().optional().describe('Optional. Deal ID.'),
    }),
  },
);

export const queryDealsTool = tool(
  async (
    input: {
      filters?: {
        dealIds?: number[];
        ownerId?: number;
        stages?: string[];
        minValue?: number;
        maxValue?: number;
        expectedCloseFrom?: string;
        expectedCloseTo?: string;
        companyId?: number;
        contactId?: number;
        search?: string;
        createdAfter?: string;
        createdBefore?: string;
      };
      aggregation?: 'count' | 'list';
      groupBy?: 'stage' | 'ownerId';
      limit?: number;
    },
    config: ToolRunConfig,
  ) => {
    const organisationId = getOrganizationId(config);
    if (!organisationId) {
      return { error: 'User context (organisationId) is required' };
    }
    const signJwt = getSignJwt(config);
    const { filters = {}, aggregation = 'list', groupBy, limit = 100 } = input;
    const result = await Backend('/deals/query', {
      method: 'POST',
      organisationId: orgHeader(organisationId),
      body: { filters, aggregation, groupBy, limit },
      signJwt,
    });
    if (!result.success) {
      return { error: result.error ?? 'Failed to query deals' };
    }
    return result.data;
  },
  {
    name: 'query_deals',
    description:
      'Query deals with filters and aggregations. Use for multiple deals (filters.dealIds), analytical questions. Supports: dealIds, ownerId, stages, minValue, maxValue, expectedCloseFrom/To, companyId, contactId, search, createdAfter/Before. aggregation: count | list. groupBy: stage | ownerId.',
    schema: z.object({
      filters: z
        .object({
          dealIds: z.array(z.number()).optional(),
          ownerId: z.number().optional(),
          stages: z.array(z.string()).optional(),
          minValue: z.number().optional(),
          maxValue: z.number().optional(),
          expectedCloseFrom: z.string().optional(),
          expectedCloseTo: z.string().optional(),
          companyId: z.number().optional(),
          contactId: z.number().optional(),
          search: z.string().optional(),
          createdAfter: z.string().optional(),
          createdBefore: z.string().optional(),
        })
        .optional(),
      aggregation: z.enum(['count', 'list']).optional().default('list'),
      groupBy: z.enum(['stage', 'ownerId']).optional(),
      limit: z.number().optional().default(100),
    }),
  },
);

export const createDealTool = tool(
  async (
    input: {
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
    },
    config: ToolRunConfig,
  ) => {
    const organisationId = getOrganizationId(config);
    const signJwt = getSignJwt(config);
    const userId = getUserId(config);
    if (!organisationId) {
      return { error: 'User context (organisationId) is required' };
    }
    const ownerIds = input.ownerIds?.length
      ? input.ownerIds
      : userId != null
        ? [userId]
        : [];
    if (ownerIds.length === 0) {
      return {
        error:
          'No owner available. Provide ownerIds or ensure userId is in context.',
      };
    }
    const result = await Backend('/deals', {
      method: 'POST',
      organisationId: orgHeader(organisationId),
      signJwt,
      body: {
        title: input.title,
        value: input.value,
        currency: input.currency,
        probability: input.probability,
        stage: input.stage,
        summary: input.summary,
        expectedCloseDate: input.expectedCloseDate,
        source: input.source,
        priority: input.priority,
        ownerIds,
        primaryOwnerId: input.primaryOwnerId,
      },
    });
    if (!result.success) {
      return { error: result.error ?? 'Failed to create deal', deal: null };
    }
    return {
      success: true,
      message: 'Deal created.',
      deal: result.data,
    };
  },
  {
    name: 'create_deal',
    description:
      'Create a new deal. title is required. ownerIds defaults to current user if omitted. Optional: value, currency, probability, stage, summary, expectedCloseDate, source, priority.',
    schema: z.object({
      title: z.string().min(1).describe('Deal title (required)'),
      value: z.number().optional(),
      currency: z.string().optional(),
      probability: z.number().min(0).max(100).optional(),
      stage: z.string().optional(),
      summary: z.string().optional(),
      expectedCloseDate: z.string().optional(),
      source: z.string().optional(),
      priority: z.number().min(0).max(4).optional(),
      ownerIds: z.array(z.number()).optional(),
      primaryOwnerId: z.number().optional(),
    }),
  },
);

export const updateDealTool = tool(
  async (
    input: {
      dealId?: number;
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
    },
    config: ToolRunConfig,
  ) => {
    const organisationId = getOrganizationId(config);
    const signJwt = getSignJwt(config);
    const contextEntities = getContextEntities(config);
    const contextDeals =
      contextEntities?.filter((e) => e.type === 'deal') ?? [];
    const dealFromContext =
      contextDeals.length === 1 ? contextDeals[0] : undefined;
    const dealId = input.dealId ?? dealFromContext?.id;

    if (dealId === undefined) {
      return {
        error: 'No deal in context and no dealId provided. Provide dealId.',
      };
    }
    if (!organisationId) {
      return { error: 'User context (organisationId) is required' };
    }
    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.value !== undefined) updates.value = input.value;
    if (input.currency !== undefined) updates.currency = input.currency;
    if (input.probability !== undefined)
      updates.probability = input.probability;
    if (input.stage !== undefined) updates.stage = input.stage;
    if (input.summary !== undefined) updates.summary = input.summary;
    if (input.expectedCloseDate !== undefined)
      updates.expectedCloseDate = input.expectedCloseDate;
    if (input.actualCloseDate !== undefined)
      updates.actualCloseDate = input.actualCloseDate;
    if (input.lostReason !== undefined) updates.lostReason = input.lostReason;
    if (input.source !== undefined) updates.source = input.source;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (Object.keys(updates).length === 0) {
      return {
        error:
          'Provide at least one field to update: title, value, currency, probability, stage, summary, expectedCloseDate, actualCloseDate, lostReason, source, or priority.',
      };
    }

    const result = await Backend(`/deals/${dealId}`, {
      method: 'PATCH',
      organisationId: orgHeader(organisationId),
      signJwt,
      body: updates,
    });
    if (!result.success) {
      return { error: result.error ?? 'Failed to update deal', deal: null };
    }
    return {
      success: true,
      message: 'Deal updated.',
      deal: result.data,
    };
  },
  {
    name: 'update_deal',
    description:
      'Update a deal. Pass only fields to change. dealId optional if single deal in context. stage can be e.g. lead, qualified, proposal, negotiation, closed_won, closed_lost.',
    schema: z.object({
      dealId: z.number().optional(),
      title: z.string().optional(),
      value: z.number().optional(),
      currency: z.string().optional(),
      probability: z.number().min(0).max(100).optional(),
      stage: z.string().optional(),
      summary: z.string().optional(),
      expectedCloseDate: z.string().optional(),
      actualCloseDate: z.string().optional(),
      lostReason: z.string().optional(),
      source: z.string().optional(),
      priority: z.number().min(0).max(4).optional(),
    }),
  },
);

export const dealTools = [
  getDealDetailsTool,
  queryDealsTool,
  createDealTool,
  updateDealTool,
];
