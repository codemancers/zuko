import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId, link } from '../lib/schemas';
import { crmRequest, recordsPath, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    'Link a record to one other record (`record_id`) or to several at once (`record_ids`, up to 500; send one or the other). Many-to-many, the same from either side; where the record holds only one for that link, this replaces it. Linking twice changes nothing. A list is added all together or not at all: if any id is missing, of the wrong kind or out of reach, nothing is linked and the error names it. The answer lists the records you passed.',
  inputSchema: z.object({
    object,
    id: recordId,
    link,
    record_id: recordId.describe('Id of the one record to link it to.').optional(),
    record_ids: z
      .array(recordId)
      .min(1)
      .max(500)
      .describe('Ids of several records to link it to, instead of record_id.')
      .optional(),
  }),
  execute: (input, ctx) =>
    crmRequest(
      ctx,
      'POST',
      `${recordsPath(input.object)}/${segment(input.id)}/associations/${segment(input.link)}`,
      input.record_ids ? { record_ids: input.record_ids } : { record_id: input.record_id },
    ),
  toModelOutput: crmOutput,
});
