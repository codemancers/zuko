import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { toEditorData } from '../lib/editor-data';
import { env } from '../lib/env';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    "Create a new deal in the Zuko CRM. Requires a title. Stage names are org-specific — discover them with query_deals groupBy 'stage' if unsure.",
  inputSchema: z.object({
    title: z.string().min(1),
    value: z.number().optional(),
    currency: z.string().optional().describe('e.g. USD'),
    probability: z.number().min(0).max(100).optional(),
    stage: z.string().optional(),
    summary: z.string().optional().describe('Plain-text summary'),
    expectedCloseDate: z.string().optional().describe('ISO 8601 date'),
    source: z.string().optional(),
    priority: z.number().int().optional(),
    ownerIds: z
      .array(z.number().int())
      .optional()
      .describe(
        'CRM user ids to own this deal; omit to use the configured default owner',
      ),
    primaryOwnerId: z.number().int().optional(),
  }),
  async execute({ summary, ownerIds, ...rest }) {
    return zukoFetch('POST', '/deals', {
      ...rest,
      summary: summary ? toEditorData(summary) : undefined,
      ownerIds: ownerIds ?? [env().ZUKO_DEFAULT_OWNER_ID],
    });
  },
});
