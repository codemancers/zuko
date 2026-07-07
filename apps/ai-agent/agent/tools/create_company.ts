import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { toEditorData } from '../lib/editor-data';
import { env } from '../lib/env';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    'Create a new company in the Zuko CRM. Requires company name and website. Query for an existing company first to avoid duplicates.',
  inputSchema: z.object({
    companyName: z.string().min(1),
    website: z.string().min(1),
    linkedinUrl: z.string().optional(),
    summary: z.string().optional().describe('Plain-text summary'),
    ownerIds: z
      .array(z.number().int())
      .optional()
      .describe(
        'CRM user ids to own this company; omit to use the configured default owner',
      ),
    primaryOwnerId: z.number().int().optional(),
  }),
  async execute({ summary, ownerIds, ...rest }) {
    return zukoFetch('POST', '/companies', {
      ...rest,
      summary: summary ? toEditorData(summary) : undefined,
      ownerIds: ownerIds ?? [env().ZUKO_DEFAULT_OWNER_ID],
    });
  },
});
