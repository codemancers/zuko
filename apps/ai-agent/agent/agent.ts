import { defineAgent } from 'eve';
import { openai } from '@ai-sdk/openai';

export default defineAgent({
  // OpenAI as the model. eve's built-in sandbox tools (bash, read_file,
  // write_file, glob, grep) drive this session's Fly Sprite via the
  // defineSandbox backend in sandbox/ — no model-specific spawn path needed.
  model: openai('gpt-4.1'),
  // eve can't look up a context window for a custom (non-AI-Gateway) model,
  // which its compaction feature needs. gpt-4.1 accepts ~1M input tokens.
  modelContextWindowTokens: 1_047_576,
});
