import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ActivityService } from '@zuko/sales';

/**
 * LangChain tool for leaving comments on entities
 * Used by AI agents to add comments to contacts, companies, or deals
 */
export function createLeaveCommentTool(activityService: ActivityService) {
  return tool(
    async ({ entityType, entityId, content, userId }) => {
      try {
        // Use provided userId to attribute the comment to the user
        const activity = await activityService.createComment(
          entityType,
          entityId,
          userId, // userId from conversation state
          content,
        );

        return {
          success: true,
          activityId: activity.id,
          message: `Comment added successfully to ${entityType} ${entityId}`,
          content,
          createdAt: activity.createdAt.toISOString(),
        };
      } catch (error) {
        if (error instanceof Error) {
          return {
            success: false,
            error: error.message,
          };
        }
        throw error;
      }
    },
    {
      name: 'leave_comment',
      description: `Leave a comment on a contact, company, or deal. The comment will be visible in the entity's activity timeline.

Use this when asked to:
- "Leave a note"
- "Add a comment"
- "Record that..."
- "Make a note that..."

Examples:
- "Leave a comment to follow up next week"
- "Add a note that they're interested in enterprise"
- "Record that the demo went well"

IMPORTANT: You must pass the userId from the conversation state to properly attribute the comment to the user.`,
      schema: z.object({
        entityType: z
          .enum(['contact', 'company', 'deal'])
          .describe('The type of entity to comment on'),
        entityId: z.number().describe('The ID of the entity'),
        content: z.string().describe('The comment text to add'),
        userId: z
          .number()
          .describe(
            'The ID of the user creating the comment (from conversation state)',
          ),
      }),
    },
  );
}
