import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId, link } from '../lib/schemas';
import { crmRequest, recordsPath, segment, query, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    'The records a record is linked to through one of its links (the companies of a contact, a deal’s primary contact), as far as the user may see them.',
  inputSchema: z.object({
    object,
    id: recordId,
    link,
    page: z.number().int().min(1).optional(),
    page_size: z.number().int().min(1).max(100).optional(),
  }),
  execute: (input, ctx) =>
    crmRequest(
      ctx,
      'GET',
      `${recordsPath(input.object)}/${segment(input.id)}/associations/${segment(input.link)}` +
        query({ page: input.page, page_size: input.page_size }),
    ),
  toModelOutput: crmOutput,
});
