import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId } from '../lib/schemas';
import { crmRequest, recordsPath, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description: 'Who changed what on a record and when, newest first.',
  inputSchema: z.object({ object, id: recordId }),
  execute: (input, ctx) =>
    crmRequest(ctx, 'GET', `${recordsPath(input.object)}/${segment(input.id)}/history`),
  toModelOutput: crmOutput,
});
