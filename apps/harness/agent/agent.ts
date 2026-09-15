import { defineAgent } from 'eve';
import { claudeCode } from './lib/model/claude-code.js';

export default defineAgent({
  // Claude Code as the model — the `claude` CLI spawned inside this session's
  // Fly Sprite (see lib/model/claude-code.ts + the sandbox/ folder, where eve
  // owns the sprite via defineSandbox).
  model: claudeCode('sonnet'),
  // eve can't look up a context window for a custom (non-AI-Gateway) model,
  // which its compaction feature needs. Supply Sonnet's 200k window explicitly.
  modelContextWindowTokens: 200_000,
});
