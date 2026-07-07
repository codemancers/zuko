import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { orgIdFromCtx, zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    'Permanently delete a task by ID. Always confirm with the user before calling this.',
  inputSchema: z.object({
    id: z.number().int().positive().describe('Task ID to delete'),
  }),
  async execute({ id }, ctx) {
    await zukoFetch('DELETE', `/tasks/${id}`, undefined, orgIdFromCtx(ctx));
    return { deleted: true, id };
  },
});
