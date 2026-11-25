import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, sortParam } from '../lib/schemas';
import { crmRequest, recordsPath, query, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    'Page through the records of an object type that the user may see, newest first by default.',
  inputSchema: z.object({
    object,
    page: z.number().int().min(1).optional(),
    page_size: z.number().int().min(1).max(100).optional(),
    sort: sortParam,
    include_links: z
      .boolean()
      .optional()
      .describe('Also return who each record is linked to, by kind.'),
  }),
  execute: (input, ctx) =>
    crmRequest(
      ctx,
      'GET',
      recordsPath(input.object) +
        query({
          page: input.page,
          page_size: input.page_size,
          sort: input.sort,
          include: input.include_links ? 'associations' : undefined,
        }),
    ),
  toModelOutput: crmOutput,
});
