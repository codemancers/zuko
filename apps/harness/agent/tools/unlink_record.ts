import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId, link } from '../lib/schemas';
import { crmRequest, recordsPath, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    'Remove the link between a record and one other (`record_id`) or several (`record_ids`, up to 500; send one or the other). Neither record is deleted. A list is removed all together or not at all: if any of them is not linked, nothing is removed and the error names it. The answer lists the records you passed.',
  inputSchema: z.object({
    object,
    id: recordId,
    link,
    record_id: recordId.describe('Id of the one record to unlink from it.').optional(),
    record_ids: z
      .array(recordId)
      .min(1)
      .max(500)
      .describe('Ids of several records to unlink from it, instead of record_id.')
      .optional(),
  }),
  execute: (input, ctx) => {
    const base = `${recordsPath(input.object)}/${segment(input.id)}/associations/${segment(input.link)}`;
    return input.record_ids
      ? crmRequest(ctx, 'POST', `${base}/unlink`, { record_ids: input.record_ids })
      : crmRequest(ctx, 'DELETE', `${base}/${segment(input.record_id ?? '')}`);
  },
  toModelOutput: crmOutput,
});
