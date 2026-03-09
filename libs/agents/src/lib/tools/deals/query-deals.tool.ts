import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { DealsService } from '@zuko/sales';
import { getOrganizationId } from '../context/tool-context';

/**
 * LangChain tool for querying deals with flexible filters
 * Used by AI agents for analytical queries about deals
 */
export function createQueryDealsTool(dealsService: DealsService) {
  return tool(
    async (
      { filters = {}, aggregation = 'list', groupBy, limit = 100 },
      config?,
    ) => {
      const organizationId = getOrganizationId(config);
      if (organizationId === undefined) {
        return {
          error:
            'No organization context. Please select an organization and try again.',
        };
      }

      try {
        const dealFilters: Record<string, unknown> = { organizationId };
        const paginationOptions = { page: 1, limit: Math.min(limit, 1000) };

        if (filters.ownerId) {
          dealFilters.ownerIds = [filters.ownerId];
        }
        if (filters.search) {
          dealFilters.search = filters.search;
        }
        if (filters.dealIds?.length) {
          dealFilters.dealIds = filters.dealIds;
        }
        if (filters.stages?.length) {
          dealFilters.stages = filters.stages;
        }
        if (filters.minValue !== undefined) {
          dealFilters.minValue = filters.minValue;
        }
        if (filters.maxValue !== undefined) {
          dealFilters.maxValue = filters.maxValue;
        }
        if (filters.expectedCloseFrom) {
          dealFilters.expectedCloseFrom = new Date(filters.expectedCloseFrom);
        }
        if (filters.expectedCloseTo) {
          dealFilters.expectedCloseTo = new Date(filters.expectedCloseTo);
        }
        if (filters.companyId) {
          dealFilters.companyIds = [filters.companyId];
        }
        if (filters.contactId) {
          dealFilters.contactIds = [filters.contactId];
        }

        const result = await dealsService.findAll(
          dealFilters as unknown as Parameters<DealsService['findAll']>[0],
          paginationOptions,
        );
        let deals = result.deals;

        // Apply post-fetch filters if needed (e.g. date ranges not in repo)
        if (filters.createdAfter) {
          const afterDate = new Date(filters.createdAfter);
          deals = deals.filter((d: { createdAt: Date }) => new Date(d.createdAt) >= afterDate);
        }
        if (filters.createdBefore) {
          const beforeDate = new Date(filters.createdBefore);
          deals = deals.filter((d: { createdAt: Date }) => new Date(d.createdAt) <= beforeDate);
        }

        if (aggregation === 'count') {
          return {
            count: deals.length,
            filters: filters,
          };
        }

        if (groupBy) {
          const grouped: Record<string, unknown[]> = {};
          for (const deal of deals) {
            const d = deal as {
              id: number;
              title: string;
              value?: number | null;
              stage?: string | null;
              owners?: Array<{ userId: number }>;
              createdAt: Date;
            };
            let key: string;
            if (groupBy === 'ownerId') {
              key = d.owners?.[0]?.userId?.toString() ?? 'no-owner';
            } else if (groupBy === 'stage') {
              key = d.stage ?? 'no-stage';
            } else {
              key = 'unknown';
            }
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push({
              id: d.id,
              title: d.title,
              value: d.value,
              stage: d.stage,
              createdAt: d.createdAt?.toISOString?.(),
            });
          }
          return {
            grouped,
            totalCount: deals.length,
            groupCount: Object.keys(grouped).length,
          };
        }

        return {
          deals: deals.slice(0, limit).map((d: any) => ({
            id: d.id,
            title: d.title,
            value: d.value,
            currency: d.currency,
            stage: d.stage,
            probability: d.probability,
            expectedCloseDate: d.expectedCloseDate?.toISOString?.() ?? null,
            companyCount: d._count?.companies ?? 0,
            contactCount: d._count?.contacts ?? 0,
            ownerCount: d.owners?.length ?? 0,
            createdAt: d.createdAt?.toISOString?.(),
          })),
          count: deals.length,
          filters: filters,
        };
      } catch (error) {
        if (error instanceof Error) {
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      name: 'query_deals',
      description: `Query deals with flexible filters and aggregations.

Use this for:
- Multiple deals from context: pass filters.dealIds with the list of IDs (e.g. [1, 2]) to fetch several deals in one call.
- Analytical questions: "How many deals in negotiation?", "Deals over $50k", "List deals closing this quarter", "Find deals owned by X", etc.

Supports:
- filters.dealIds: array of deal IDs (use when context has multiple deals)
- Filtering by owner, stage, value range, expected close date, company, contact, search
- Aggregation: count or list
- Group by: stage or ownerId
- Limit results (default 100, max 1000)`,
      schema: z.object({
        filters: z
          .object({
            dealIds: z
              .array(z.number())
              .optional()
              .describe(
                'Fetch only these deal IDs (e.g. when context has multiple deals)',
              ),
            ownerId: z.number().optional().describe('Filter by owner user ID'),
            stages: z
              .array(z.string())
              .optional()
              .describe('Filter by deal stage(s)'),
            minValue: z.number().optional().describe('Minimum deal value'),
            maxValue: z.number().optional().describe('Maximum deal value'),
            expectedCloseFrom: z
              .string()
              .optional()
              .describe('Expected close date from (ISO 8601)'),
            expectedCloseTo: z
              .string()
              .optional()
              .describe('Expected close date to (ISO 8601)'),
            companyId: z
              .number()
              .optional()
              .describe('Filter by associated company ID'),
            contactId: z
              .number()
              .optional()
              .describe('Filter by associated contact ID'),
            search: z
              .string()
              .optional()
              .describe('Search in title, summary, source'),
            createdAfter: z
              .string()
              .optional()
              .describe('Filter by creation date (ISO 8601)'),
            createdBefore: z
              .string()
              .optional()
              .describe('Filter by creation date (ISO 8601)'),
          })
          .optional()
          .describe('Filter criteria'),
        aggregation: z
          .enum(['count', 'list'])
          .optional()
          .default('list')
          .describe(
            'Type of result: count returns just the number, list returns deal details',
          ),
        groupBy: z
          .enum(['stage', 'ownerId'])
          .optional()
          .describe('Group results by field'),
        limit: z
          .number()
          .optional()
          .default(100)
          .describe('Maximum number of results to return (max 1000)'),
      }),
    },
  );
}
