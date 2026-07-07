import { defineTool } from 'eve/tools';
import { z } from 'zod';
import { setRuntimeSessionToken } from '../lib/zuko-client';

export default defineTool({
  description:
    'Store a Better Auth session token so other tools can authenticate. ' +
    'Copy the better-auth.session_token cookie value from browser DevTools → Application → Cookies.',
  inputSchema: z.object({
    token: z.string().min(1).describe('The better-auth.session_token cookie value'),
  }),
  async execute({ token }) {
    setRuntimeSessionToken(token);
    return { authenticated: true };
  },
});
