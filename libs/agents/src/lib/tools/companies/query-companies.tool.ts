import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { CompaniesService } from '@zuko/sales';

/**
 * LangChain tool for querying companies with flexible filters
 * Used by AI agents for analytical queries about companies
 */
export function createQueryCompaniesTool(companiesService: CompaniesService) {
  return tool(
    async ({ filters = {}, aggregation = 'list', limit = 100 }) => {
      try {
        const companyFilters: Record<string, unknown> = {};
        const paginationOptions = { limit: Math.min(limit, 1000) }; // Cap at 1000

        if (filters.search) {
          companyFilters.search = filters.search;
        }

        if (filters.ownerId) {
          companyFilters.ownerIds = [filters.ownerId];
        }

        // Fetch companies
        const result = await companiesService.findAll(
          companyFilters,
          paginationOptions
        );
        let companies = result.companies;

        // Apply post-fetch filters
        if (filters.hasWebsite !== undefined) {
          companies = companies.filter((a) =>
            filters.hasWebsite ? !!a.website : !a.website
          );
        }

        if (filters.createdAfter) {
          const afterDate = new Date(filters.createdAfter);
          companies = companies.filter(
            (a) => new Date(a.createdAt) >= afterDate
          );
        }

        if (filters.createdBefore) {
          const beforeDate = new Date(filters.createdBefore);
          companies = companies.filter(
            (a) => new Date(a.createdAt) <= beforeDate
          );
        }

        if (filters.contactCountMin !== undefined) {
          companies = companies.filter(
            (a) => (a._count?.contacts || 0) >= filters.contactCountMin!
          );
        }

        if (filters.contactCountMax !== undefined) {
          companies = companies.filter(
            (a) => (a._count?.contacts || 0) <= filters.contactCountMax!
          );
        }

        // Handle aggregation
        if (aggregation === 'count') {
          return {
            count: companies.length,
            filters: filters,
          };
        }

        // Default: return list of companies
        return {
          companies: companies.slice(0, limit).map((a) => ({
            id: a.id,
            companyName: a.companyName,
            website: a.website,
            contactCount: a._count?.contacts || 0,
            createdAt: a.createdAt.toISOString(),
          })),
          count: companies.length,
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
      name: 'query_companies',
      description: `Query companies with flexible filters and aggregations.

Use this for analytical questions like:
- "How many companies have websites?"
- "Show me companies with more than 5 contacts"
- "List companies created this quarter"
- "Find companies owned by Bob"

Supports:
- Filtering by owner, website presence, contact count, date range
- Aggregation: count or list
- Limit results (default 100, max 1000)`,
      schema: z.object({
        filters: z
          .object({
            ownerId: z.number().optional().describe('Filter by owner user ID'),
            hasWebsite: z
              .boolean()
              .optional()
              .describe('Filter by website presence'),
            contactCountMin: z
              .number()
              .optional()
              .describe('Minimum number of contacts'),
            contactCountMax: z
              .number()
              .optional()
              .describe('Maximum number of contacts'),
            createdAfter: z
              .string()
              .optional()
              .describe('Filter by creation date (ISO 8601 format)'),
            createdBefore: z
              .string()
              .optional()
              .describe('Filter by creation date (ISO 8601 format)'),
            search: z.string().optional().describe('Search in company name'),
          })
          .optional()
          .describe('Filter criteria'),
        aggregation: z
          .enum(['count', 'list'])
          .optional()
          .default('list')
          .describe(
            'Type of result: count returns just the number, list returns company details'
          ),
        limit: z
          .number()
          .optional()
          .default(100)
          .describe('Maximum number of results to return (max 1000)'),
      }),
    }
  );
}
