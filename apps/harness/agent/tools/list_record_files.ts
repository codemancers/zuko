import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId } from '../lib/schemas';
import { crmRequest, recordsPath, segment, query, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    "List every file attached to a record, newest first: the ones in its file fields and the ones on its comments. Each item gives the file (id, filename, type, size), where it came from (a field, or a comment id), when, and who attached it. Use get_file with an id to open one. Seeing the record is enough.",
  inputSchema: z.object({
    object,
    id: recordId,
    limit: z.number().int().min(1).max(200).optional().describe('At most this many, default 100.'),
  }),
  execute: (input, ctx) =>
    crmRequest(
      ctx,
      'GET',
      `${recordsPath(input.object)}/${segment(input.id)}/files${query({ limit: input.limit })}`,
    ),
  toModelOutput: crmOutput,
});
