import { z } from 'zod';
import { defineTool } from './base';

const MAX_BYTES = 2_000_000;

export const webFetchTool = defineTool({
  name: 'web_fetch',
  description:
    'Fetch a URL and return its text body (capped at 2 MB). GET only.',
  schema: z.object({
    url: z.string().url(),
    method: z.enum(['GET']).optional(),
  }),
  execute: async ({ url }) => {
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      body: text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text,
      truncated: text.length > MAX_BYTES,
    };
  },
});
