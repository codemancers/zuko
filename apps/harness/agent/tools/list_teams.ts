import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { crmRequest, crmOutput } from '../lib/backend';

export default defineTool({
  description: 'Teams in the organization with their ids.',
  inputSchema: z.object({}),
  execute: (input, ctx) => crmRequest(ctx, 'GET', 'teams'),
  toModelOutput: crmOutput,
});
