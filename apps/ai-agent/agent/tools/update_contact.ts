import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { toEditorData } from '../lib/editor-data';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    'Update an existing Zuko CRM contact by id. Only provided fields change. Confirm the id with a query first.',
  inputSchema: z.object({
    id: z.number().int().positive().describe('Contact id'),
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional().describe('E.164 format, e.g. +14155552671'),
    linkedinId: z.string().optional(),
    notes: z
      .string()
      .optional()
      .describe('Plain-text notes (replaces existing)'),
  }),
  async execute({ id, notes, ...rest }) {
    return zukoFetch('PATCH', `/contacts/${id}`, {
      ...rest,
      notes: notes ? toEditorData(notes) : undefined,
    });
  },
});
