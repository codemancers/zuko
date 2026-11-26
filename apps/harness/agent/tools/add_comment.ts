import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId, commentBody, mentions } from '../lib/schemas';
import { crmRequest, commentsPath, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    'Add a comment to a record. Seeing the record is enough; changing it is not required. ' +
    'Use it to leave a note, to say why you changed something, or to log a call or meeting. ' +
    "It is shown to everyone who can see the record, recorded as written by an agent on the user's behalf.",
  inputSchema: z.object({ object, id: recordId, body: commentBody, mentions }),
  execute: (input, ctx) =>
    crmRequest(ctx, 'POST', commentsPath(input.object, input.id), {
      body: input.body,
      mentions: input.mentions,
    }),
  toModelOutput: crmOutput,
});
