import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object } from '../lib/schemas';
import { crmRequest, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    'Fields, types, required/unique/filterable flags and enum options. Call before creating, updating or filtering records.',
  inputSchema: z.object({ object }),
  execute: (input, ctx) => crmRequest(ctx, 'GET', `objects/${segment(input.object)}`),
  toModelOutput: crmOutput,
});
