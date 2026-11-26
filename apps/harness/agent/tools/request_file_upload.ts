import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { crmRequest, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    "Get a link to upload a file to Zuko from outside the app, for example from a terminal. Returns a signed upload URL that works once and for 5 minutes, and the curl command to use it: `curl -sS -F 'file=@/path/to/file' '<upload_url>'`. The reply to that upload is the stored file as JSON; its `id` is what get_file, update_record, add_comment and the Zuko agent take (for example, tell the agent \"open file 7\"). The link is a secret that lets anyone holding it upload as this user: use it immediately, do not paste it into messages or files, and ask for a new one if an upload fails. In the Zuko app people attach files with the paperclip; this is for clients that cannot.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const link = (await crmRequest(ctx, 'POST', 'files/uploads', {})) as
      | { upload_url: string }
      | { zuko_error: unknown };
    if ('zuko_error' in link) return link;
    return {
      ...link,
      curl: `curl -sS -F 'file=@/path/to/file' '${link.upload_url}'`,
      next: 'The upload replies with the stored file as JSON. Use its id with get_file, update_record, add_comment, or tell the Zuko agent to open it. Each link works once.',
    };
  },
  toModelOutput: crmOutput,
});
