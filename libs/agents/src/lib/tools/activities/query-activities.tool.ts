import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ActivityService } from '@zuko/sales';

/**
 * LangChain tool for querying activity timeline
 * Used by AI agents to search comments, updates, and other activities
 */
export function createQueryActivitiesTool(activityService: ActivityService) {
  return tool(
    async ({
      entityType,
      entityId,
      activityType,
      actorId,
      createdAfter,
      limit = 50,
    }) => {
      try {
        const filters: any = {};

        if (entityType) {
          filters.entityType = entityType;
        }

        if (entityId) {
          filters.entityId = entityId;
        }

        if (activityType) {
          filters.activityType = activityType;
        }

        if (actorId) {
          filters.actorId = actorId;
        }

        const paginationOptions = { limit: Math.min(limit, 500) }; // Cap at 500

        // Fetch activities
        const result = await activityService.findAll(
          filters,
          paginationOptions
        );
        let activities = result.activities;

        // Apply date filter post-fetch
        if (createdAfter) {
          const afterDate = new Date(createdAfter);
          activities = activities.filter(
            (a) => new Date(a.createdAt) >= afterDate
          );
        }

        // Format activities for response
        return {
          activities: activities.map((a) => ({
            id: a.id,
            activityType: a.activityType,
            entityType: a.entityType,
            entityId: a.entityId,
            content: a.content,
            actor: a.actor
              ? {
                  id: a.actor.id,
                  name: a.actor.name,
                  email: a.actor.email,
                }
              : null,
            createdAt: a.createdAt.toISOString(),
          })),
          count: activities.length,
          filters: {
            entityType,
            entityId,
            activityType,
            actorId,
            createdAfter,
          },
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
      name: 'query_activities',
      description: `Query activity timeline (comments, updates, etc.) for entities.

Use this for questions like:
- "What activities happened on this contact this week?"
- "Show me recent comments on this company"
- "What did Alice do recently?"
- "List all activities for contact 123"

Supports:
- Filtering by entity type/ID, activity type, actor, date
- Returns activity details with actor information
- Limit results (default 50, max 500)`,
      schema: z.object({
        entityType: z
          .enum(['contact', 'company', 'deal'])
          .optional()
          .describe('Filter by entity type'),
        entityId: z
          .number()
          .optional()
          .describe('Filter by specific entity ID'),
        activityType: z
          .string()
          .optional()
          .describe(
            'Filter by activity type (e.g., "comment", "field_update")'
          ),
        actorId: z
          .number()
          .optional()
          .describe('Filter by user who performed the activity'),
        createdAfter: z
          .string()
          .optional()
          .describe('Filter by creation date (ISO 8601 format)'),
        limit: z
          .number()
          .optional()
          .default(50)
          .describe('Maximum number of results to return (max 500)'),
      }),
    }
  );
}
