import { openai } from '@ai-sdk/openai';
import { defineAgent } from 'eve';

export default defineAgent({
  // Direct OpenAI provider (OPENAI_API_KEY), matching the backend's default
  // agent model. Swap to a gateway string (e.g. "openai/gpt-4.1") to route
  // through the Vercel AI Gateway instead.
  model: openai('gpt-4.1'),
});
