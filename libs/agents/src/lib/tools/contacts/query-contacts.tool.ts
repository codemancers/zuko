import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ContactsService } from '@zuko/sales';

/**
 * LangChain tool for querying contacts with flexible filters
 * Used by AI agents for analytical queries about contacts
 */
export function createQueryContactsTool(contactsService: ContactsService) {
  return tool(
    async ({ filters = {}, aggregation = 'list', groupBy, limit = 100 }) => {
      try {
        // Build filter object for ContactsService
        const contactFilters: any = {};
        const paginationOptions: any = { limit: Math.min(limit, 1000) }; // Cap at 1000

        if (filters.ownerId) {
          contactFilters.ownerIds = [filters.ownerId];
        }

        if (filters.hasEmail !== undefined) {
          // This requires a custom query - we'll filter post-fetch for now
          // In production, you'd add this to the repository
        }

        if (filters.search) {
          contactFilters.search = filters.search;
        }

        // Fetch contacts
        const result = await contactsService.findAll(contactFilters, paginationOptions);
        let contacts = result.contacts;

        // Apply post-fetch filters
        if (filters.createdAfter) {
          const afterDate = new Date(filters.createdAfter);
          contacts = contacts.filter(c => new Date(c.createdAt) >= afterDate);
        }

        if (filters.createdBefore) {
          const beforeDate = new Date(filters.createdBefore);
          contacts = contacts.filter(c => new Date(c.createdAt) <= beforeDate);
        }

        if (filters.hasEmail !== undefined) {
          contacts = contacts.filter(c => filters.hasEmail ? !!c.email : !c.email);
        }

        // Handle aggregation
        if (aggregation === 'count') {
          return {
            count: contacts.length,
            filters: filters,
          };
        }

        // Handle groupBy
        if (groupBy) {
          const grouped: Record<string, any> = {};

          for (const contact of contacts) {
            let key: string;
            if (groupBy === 'ownerId') {
              key = contact.owners?.[0]?.userId?.toString() || 'no-owner';
            } else {
              key = 'unknown';
            }

            if (!grouped[key]) {
              grouped[key] = [];
            }
            grouped[key].push({
              id: contact.id,
              name: contact.name,
              email: contact.email,
              createdAt: contact.createdAt.toISOString(),
            });
          }

          return {
            grouped,
            totalCount: contacts.length,
            groupCount: Object.keys(grouped).length,
          };
        }

        // Default: return list of contacts
        return {
          contacts: contacts.slice(0, limit).map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            createdAt: c.createdAt.toISOString(),
            ownerCount: c.owners?.length || 0,
          })),
          count: contacts.length,
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
      name: 'query_contacts',
      description: `Query contacts with flexible filters and aggregations.

Use this for analytical questions like:
- "How many contacts were created last month?"
- "Show me contacts owned by Alice"
- "List contacts created this year"
- "How many contacts have email addresses?"

Supports:
- Filtering by owner, date range, email presence
- Aggregation: count or list
- Group by: owner
- Limit results (default 100, max 1000)`,
      schema: z.object({
        filters: z
          .object({
            ownerId: z.number().optional().describe('Filter by owner user ID'),
            createdAfter: z.string().optional().describe('Filter by creation date (ISO 8601 format, e.g., "2026-01-01")'),
            createdBefore: z.string().optional().describe('Filter by creation date (ISO 8601 format)'),
            hasEmail: z.boolean().optional().describe('Filter by email presence (true = has email, false = no email)'),
            search: z.string().optional().describe('Search in name, email, phone, linkedinId'),
          })
          .optional()
          .describe('Filter criteria'),
        aggregation: z
          .enum(['count', 'list'])
          .optional()
          .default('list')
          .describe('Type of result: count returns just the number, list returns contact details'),
        groupBy: z
          .enum(['ownerId'])
          .optional()
          .describe('Group results by field'),
        limit: z
          .number()
          .optional()
          .default(100)
          .describe('Maximum number of results to return (max 1000)'),
      }),
    }
  );
}
