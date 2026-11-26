import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId, commentId, commentBody, mentions, fileIds } from '../lib/schemas';
import { crmRequest, commentsPath, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    "Edit one of the user's own comments on a record; it is shown as edited. Other people's comments cannot be edited. Mentions and files (file_ids), when given, replace the existing ones.",
  inputSchema: z.object({
    object,
    id: recordId,
    comment_id: commentId,
    body: commentBody.optional(),
    mentions,
    file_ids: fileIds,
  }),
  execute: (input, ctx) =>
    crmRequest(
      ctx,
      'PATCH',
      `${commentsPath(input.object, input.id)}/${segment(input.comment_id)}`,
      {
        body: input.body,
        mentions: input.mentions,
        files: input.file_ids,
      },
    ),
  toModelOutput: crmOutput,
});
