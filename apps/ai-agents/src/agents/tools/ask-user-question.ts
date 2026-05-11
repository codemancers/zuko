import { z } from 'zod';
import { defineTool } from './base';

export const askUserQuestionTool = defineTool({
  name: 'ask_user_question',
  description:
    'Pause the agent and ask the user a question with optional choices. The agent runtime intercepts this and waits for the user reply before continuing.',
  schema: z.object({
    question: z.string(),
    choices: z.array(z.string()).optional(),
  }),
  execute: async () => ({ pending: true }) as const,
});
