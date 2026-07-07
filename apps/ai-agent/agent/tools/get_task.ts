import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description: 'Get full details for a single task by ID, including subtasks.',
  inputSchema: z.object({
    id: z.number().int().positive().describe('Task ID'),
  }),
  async execute({ id }) {
    return zukoFetch('GET', `/tasks/${id}`);
  },
});
