import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId } from '../lib/schemas';
import { crmRequest, recordsPath, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    "Read what Apollo returned the last time this record was enriched (the provider's full response, with more than the record's own fields). " +
    'Empty when it was never enriched; call enrich_record to do that.',
  inputSchema: z.object({ object, id: recordId }),
  execute: (input, ctx) =>
    crmRequest(ctx, 'GET', `${recordsPath(input.object)}/${segment(input.id)}/enrichment`),
  toModelOutput: crmOutput,
});
