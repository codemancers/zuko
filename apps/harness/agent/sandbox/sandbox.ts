import { defineSandbox } from 'eve/sandbox';
import { createFlySpriteBackend } from './fly-sprite.js';

/**
 * eve's per-session sandbox, backed by a Fly Sprite. Declares the sandbox so eve
 * owns the lifecycle when its own tools run (provision on first use, resume,
 * shutdown). The claude-code model doesn't drive eve's tools and eve exposes no
 * way for it to reach this session, so it self-provisions the sprite via the
 * shared helpers in fly-sprite.ts — the same deterministic name + backend, so
 * both converge on one per-session VM.
 */
export default defineSandbox({
  backend: createFlySpriteBackend(),
});
