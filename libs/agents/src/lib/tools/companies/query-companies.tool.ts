import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { CompaniesService } from '@zuko/sales';
import { getOrganizationId } from '../context/tool-context';

/**
 * LangChain tool for querying companies with flexible filters
 * Used by AI agents for analytical queries about companies
 */
export function createQueryCompaniesTool(companiesService: CompaniesService) {
  return tool(
    async ({ filters = {}, aggregation = 'list', limit = 100 }, config?) => {
      const organizationId = getOrganizationId(config);
      if (organizationId === undefined) {
        return {
          error:
            'No organization context. Please select an organization and try again.',
        };
      }

      try {
        const companyFilters: {
          organizationId: number;
          search?: string;
          ownerIds?: number[];
          companyIds?: number[];
        } = { organizationId };
        const paginationOptions = { limit: Math.min(limit, 1000) }; // Cap at 1000

        if (filters.search) {
          companyFilters.search = filters.search;
        }

        if (filters.ownerId) {
          companyFilters.ownerIds = [filters.ownerId];
        }

        if (filters.companyIds?.length) {
          companyFilters.companyIds = filters.companyIds;
        }

        // Fetch companies
        const result = await companiesService.findAll(
          companyFilters,
          paginationOptions,
        );
        let companies = result.companies;

        // Apply post-fetch filters
        if (filters.hasWebsite !== undefined) {
          companies = companies.filter((a) =>
            filters.hasWebsite ? !!a.website : !a.website,
          );
        }

        if (filters.createdAfter) {
          const afterDate = new Date(filters.createdAfter);
          companies = companies.filter(
            (a) => new Date(a.createdAt) >= afterDate,
          );
        }

        if (filters.createdBefore) {
          const beforeDate = new Date(filters.createdBefore);
          companies = companies.filter(
            (a) => new Date(a.createdAt) <= beforeDate,
          );
        }

        if (filters.contactCountMin !== undefined) {
          companies = companies.filter(
            (a) => (a._count?.contacts || 0) >= filters.contactCountMin!,
          );
        }

        if (filters.contactCountMax !== undefined) {
          companies = companies.filter(
            (a) => (a._count?.contacts || 0) <= filters.contactCountMax!,
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

Use this for:
- Multiple companies from context: pass filters.companyIds with the list of IDs (e.g. [1, 2]) to fetch several companies in one call.
- Analytical questions: "How many companies have websites?", "Show companies with more than 5 contacts", "List companies created this quarter", "Find companies owned by Bob", etc.

Supports:
- filters.companyIds: array of company IDs (use when context has multiple companies)
- Filtering by owner, website presence, contact count, date range, search
- Aggregation: count or list
- Limit results (default 100, max 1000)`,
      schema: z.object({
        filters: z
          .object({
            companyIds: z
              .array(z.number())
              .optional()
              .describe(
                'Fetch only these company IDs (e.g. when context has multiple companies)',
              ),
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
            'Type of result: count returns just the number, list returns company details',
          ),
        limit: z
          .number()
          .optional()
          .default(100)
          .describe('Maximum number of results to return (max 1000)'),
      }),
    },
  );
}
