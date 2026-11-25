import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId, link } from '../lib/schemas';
import { crmRequest, recordsPath, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description: 'Remove the link between two records. Neither record is deleted.',
  inputSchema: z.object({
    object,
    id: recordId,
    link,
    record_id: recordId.describe('Id of the record to unlink from it.'),
  }),
  execute: (input, ctx) =>
    crmRequest(
      ctx,
      'DELETE',
      `${recordsPath(input.object)}/${segment(input.id)}/associations/${segment(input.link)}/${segment(input.record_id)}`,
    ),
  toModelOutput: crmOutput,
});
