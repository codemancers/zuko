import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { AccountsService } from '@zuko/sales';

/**
 * LangChain tool for querying accounts with flexible filters
 * Used by AI agents for analytical queries about accounts/companies
 */
export function createQueryAccountsTool(accountsService: AccountsService) {
  return tool(
    async ({ filters = {}, aggregation = 'list', limit = 100 }) => {
      try {
        const accountFilters: any = {};
        const paginationOptions: any = { limit: Math.min(limit, 1000) }; // Cap at 1000

        if (filters.search) {
          accountFilters.search = filters.search;
        }

        if (filters.ownerId) {
          accountFilters.ownerIds = [filters.ownerId];
        }

        // Fetch accounts
        const result = await accountsService.findAll(accountFilters, paginationOptions);
        let accounts = result.accounts;

        // Apply post-fetch filters
        if (filters.hasWebsite !== undefined) {
          accounts = accounts.filter(a => filters.hasWebsite ? !!a.website : !a.website);
        }

        if (filters.createdAfter) {
          const afterDate = new Date(filters.createdAfter);
          accounts = accounts.filter(a => new Date(a.createdAt) >= afterDate);
        }

        if (filters.createdBefore) {
          const beforeDate = new Date(filters.createdBefore);
          accounts = accounts.filter(a => new Date(a.createdAt) <= beforeDate);
        }

        if (filters.contactCountMin !== undefined) {
          accounts = accounts.filter(a => (a._count?.contacts || 0) >= filters.contactCountMin!);
        }

        if (filters.contactCountMax !== undefined) {
          accounts = accounts.filter(a => (a._count?.contacts || 0) <= filters.contactCountMax!);
        }

        // Handle aggregation
        if (aggregation === 'count') {
          return {
            count: accounts.length,
            filters: filters,
          };
        }

        // Default: return list of accounts
        return {
          accounts: accounts.slice(0, limit).map(a => ({
            id: a.id,
            companyName: a.companyName,
            website: a.website,
            contactCount: a._count?.contacts || 0,
            createdAt: a.createdAt.toISOString(),
          })),
          count: accounts.length,
          filters: filters,
        };
      } catch (error) {
        if (error instanceof Error) {
          return {
            error: error.message,
          };
        }
        throw error;
      }
    },
    {
      name: 'query_accounts',
      description: `Query accounts/companies with flexible filters and aggregations.

Use this for analytical questions like:
- "How many accounts have websites?"
- "Show me accounts with more than 5 contacts"
- "List accounts created this quarter"
- "Find accounts owned by Bob"

Supports:
- Filtering by owner, website presence, contact count, date range
- Aggregation: count or list
- Limit results (default 100, max 1000)`,
      schema: z.object({
        filters: z
          .object({
            ownerId: z.number().optional().describe('Filter by owner user ID'),
            hasWebsite: z.boolean().optional().describe('Filter by website presence'),
            contactCountMin: z.number().optional().describe('Minimum number of contacts'),
            contactCountMax: z.number().optional().describe('Maximum number of contacts'),
            createdAfter: z.string().optional().describe('Filter by creation date (ISO 8601 format)'),
            createdBefore: z.string().optional().describe('Filter by creation date (ISO 8601 format)'),
            search: z.string().optional().describe('Search in company name'),
          })
          .optional()
          .describe('Filter criteria'),
        aggregation: z
          .enum(['count', 'list'])
          .optional()
          .default('list')
          .describe('Type of result: count returns just the number, list returns account details'),
        limit: z
          .number()
          .optional()
          .default(100)
          .describe('Maximum number of results to return (max 1000)'),
      }),
    }
  );
}
