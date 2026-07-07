import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description:
    'Permanently delete a task by ID. Always confirm with the user before calling this.',
  inputSchema: z.object({
    id: z.number().int().positive().describe('Task ID to delete'),
  }),
  async execute({ id }) {
    await zukoFetch('DELETE', `/tasks/${id}`);
    return { deleted: true, id };
  },
});
