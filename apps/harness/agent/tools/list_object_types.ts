import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { crmRequest, crmOutput } from '../lib/backend';

export default defineTool({
  description: 'List the kinds of records in this CRM (contact, deal, ...).',
  inputSchema: z.object({}),
  execute: (input, ctx) => crmRequest(ctx, 'GET', 'objects'),
  toModelOutput: crmOutput,
});
