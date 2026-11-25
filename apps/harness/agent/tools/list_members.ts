import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { crmRequest, crmOutput } from '../lib/backend';

export default defineTool({
  description: 'People in the organization with their user ids, e.g. to assign a record owner.',
  inputSchema: z.object({}),
  execute: (input, ctx) => crmRequest(ctx, 'GET', 'members'),
  toModelOutput: crmOutput,
});
