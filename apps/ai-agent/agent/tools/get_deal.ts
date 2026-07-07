import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description: 'Get full details of a Zuko CRM deal by its numeric id.',
  inputSchema: z.object({
    id: z.number().int().positive().describe('Deal id'),
  }),
  async execute({ id }) {
    return zukoFetch('GET', `/deals/${id}`);
  },
});
