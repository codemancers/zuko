import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId, assignee } from '../lib/schemas';
import { crmRequest, recordsPath, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    'Change some properties of a record; fields not mentioned stay as they are, and null clears an optional field.',
  inputSchema: z.object({
    object,
    id: recordId,
    properties: z.record(z.string(), z.unknown()).optional(),
    owner_id: assignee,
    team_id: assignee,
  }),
  execute: (input, ctx) =>
    crmRequest(ctx, 'PATCH', `${recordsPath(input.object)}/${segment(input.id)}`, {
      properties: input.properties,
      owner_id: input.owner_id,
      team_id: input.team_id,
    }),
  toModelOutput: crmOutput,
});
