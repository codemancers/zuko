import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, assignee } from '../lib/schemas';
import { crmRequest, recordsPath, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    "Create a record. Properties must match the object's fields (see describe_object_type). The creator owns it unless owner_id is given.",
  inputSchema: z.object({
    object,
    properties: z.record(z.string(), z.unknown()),
    owner_id: assignee,
    team_id: assignee,
  }),
  execute: (input, ctx) =>
    crmRequest(ctx, 'POST', recordsPath(input.object), {
      properties: input.properties,
      owner_id: input.owner_id,
      team_id: input.team_id,
    }),
  toModelOutput: crmOutput,
});
