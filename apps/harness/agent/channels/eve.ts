import { eveChannel, defaultEveAuth } from 'eve/channels/eve';
import { withAuthChallenges, ForbiddenError } from 'eve/channels/auth';
import { zukoAuth } from '../lib/auth';
import { fileProblems, MAX_FILE_BYTES, resolveUploadedFile } from '../lib/files';

export default eveChannel({
  auth: withAuthChallenges(zukoAuth(true), [{ scheme: 'Bearer' }]),
  // The same cap as the backend. Types are not restricted: unknown ones reach the model as a label.
  uploadPolicy: { maxBytes: MAX_FILE_BYTES },
  // Files come by reference to Zuko's own store; see lib/files.ts.
  fetchFile: resolveUploadedFile,
  onMessage(ctx, message) {
    const problems = fileProblems(message);
    if (problems.length > 0)
      throw new ForbiddenError({ code: 'inline_file_refused', message: problems.join('; ') });
    return { auth: defaultEveAuth(ctx) };
  },
});
