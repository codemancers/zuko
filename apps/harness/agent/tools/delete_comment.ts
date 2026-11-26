import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId, commentId } from '../lib/schemas';
import { crmRequest, commentsPath, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    "Delete a comment from a record's timeline. People may delete their own comments; owners and admins may delete anyone's. Only do this when the user asked for it.",
  inputSchema: z.object({ object, id: recordId, comment_id: commentId }),
  execute: (input, ctx) =>
    crmRequest(
      ctx,
      'DELETE',
      `${commentsPath(input.object, input.id)}/${segment(input.comment_id)}`,
    ),
  toModelOutput: crmOutput,
});
