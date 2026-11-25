import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId } from '../lib/schemas';
import { crmRequest, recordsPath, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    'Delete a record. It disappears from the CRM and this cannot be undone through this server.',
  inputSchema: z.object({ object, id: recordId }),
  execute: (input, ctx) =>
    crmRequest(ctx, 'DELETE', `${recordsPath(input.object)}/${segment(input.id)}`),
  toModelOutput: crmOutput,
});
