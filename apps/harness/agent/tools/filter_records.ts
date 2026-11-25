import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, filterGroups } from '../lib/schemas';
import { crmRequest, recordsPath, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    'Find records with filters (equals, ranges, IN, null checks, contains/starts/ends with), sorting and paging. Only filterable fields can be used.',
  inputSchema: z.object({
    object,
    filter_groups: filterGroups,
    pagination: z
      .object({
        page: z.number().int().min(1).optional(),
        page_size: z.number().int().min(1).max(100).optional(),
      })
      .optional(),
    sort: z
      .object({ field: z.string(), direction: z.enum(['ASC', 'DESC', 'asc', 'desc']) })
      .optional(),
    include_links: z
      .boolean()
      .optional()
      .describe('Also return who each record is linked to, by kind.'),
  }),
  execute: (input, ctx) =>
    crmRequest(ctx, 'POST', recordsPath(input.object) + '/filter', {
      filter_groups: input.filter_groups,
      pagination: input.pagination,
      sort: input.sort,
      include: input.include_links ? ['associations'] : [],
    }),
  toModelOutput: crmOutput,
});
