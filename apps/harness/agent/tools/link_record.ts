import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId, link } from '../lib/schemas';
import { crmRequest, recordsPath, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    'Link a record to another through one of its links. Many-to-many, the same from either side; where the record holds only one for that link, this replaces it. Linking twice changes nothing.',
  inputSchema: z.object({
    object,
    id: recordId,
    link,
    record_id: recordId.describe('Id of the record to link it to.'),
  }),
  execute: (input, ctx) =>
    crmRequest(
      ctx,
      'POST',
      `${recordsPath(input.object)}/${segment(input.id)}/associations/${segment(input.link)}`,
      { record_id: input.record_id },
    ),
  toModelOutput: crmOutput,
});
