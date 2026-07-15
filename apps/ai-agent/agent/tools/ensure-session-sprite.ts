import { defineDynamic } from 'eve/tools';
import { type EvePrincipal } from '../lib/eve-principal.js';
import { ensureSessionSprite } from '../sandbox/fly-sprite.js';

/** Pull {userId, orgId} from the eve session auth, or `undefined` if the
 * session carries no principal (only eve's own unauthenticated sandbox
 * lifecycle — no creds are then written). */
export function principalFromSession(auth: {
  current?: {
    principalId?: string;
    attributes?: Record<string, unknown>;
  } | null;
}): EvePrincipal | undefined {
  const cur = auth.current;
  if (!cur) return undefined;
  const userId = Number(cur.principalId);
  const orgRaw = cur.attributes?.['orgId'];
  const orgId = Number(Array.isArray(orgRaw) ? orgRaw[0] : orgRaw);
  if (!Number.isFinite(userId) || !Number.isFinite(orgId)) return undefined;
  return { userId, orgId };
}

/**
 * Not a real dynamic tool — borrowed as eve's awaited pre-model seam. A
 * `step.started` resolver runs BEFORE each model call, inside the session's
 * AsyncLocalStorage, and eve awaits it. We use it to provision this session's
 * Fly Sprite once (via the sandbox helpers) so the synchronous
 * `spawnClaudeCodeProcess` hook (model/claude-code.ts) can read its handle.
 * Contributes no tools (`return null`).
 */
export default defineDynamic({
  events: {
    'step.started': async (_event, ctx) => {
      await ensureSessionSprite(
        ctx.session.id,
        principalFromSession(ctx.session.auth),
      );
      return null;
    },
  },
});
