import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { toEditorData } from '../lib/editor-data';
import { env } from '../lib/env';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    'Create a new contact in the Zuko CRM. Requires name and email. Query for an existing contact first to avoid duplicates.',
  inputSchema: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional().describe('E.164 format, e.g. +14155552671'),
    linkedinId: z.string().optional(),
    notes: z.string().optional().describe('Plain-text notes'),
    ownerIds: z
      .array(z.number().int())
      .optional()
      .describe(
        'CRM user ids to own this contact; omit to use the configured default owner',
      ),
    primaryOwnerId: z.number().int().optional(),
  }),
  async execute({ notes, ownerIds, ...rest }) {
    return zukoFetch('POST', '/contacts', {
      ...rest,
      notes: notes ? toEditorData(notes) : undefined,
      ownerIds: ownerIds ?? [env().ZUKO_DEFAULT_OWNER_ID],
    });
  },
});
