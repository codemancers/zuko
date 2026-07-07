import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { zukoFetch } from '../lib/zuko-client';

export default defineTool({
  description: 'Get full details of a Zuko CRM company by its numeric id.',
  inputSchema: z.object({
    id: z.number().int().positive().describe('Company id'),
  }),
  async execute({ id }) {
    return zukoFetch('GET', `/companies/${id}`);
  },
});
