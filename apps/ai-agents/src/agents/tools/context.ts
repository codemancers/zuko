import type { RunnableConfig } from '@langchain/core/runnables';
import { LocalSandbox, SpriteSandbox, type Sandbox } from './sandbox';

/** Default working directory inside the sprite. */
export const WORKING_DIR = process.env.WORKING_DIR ?? '/home/sprite/zuko';

export interface ToolContext {
  sandbox: Sandbox;
  workingDirectory?: string;
  userId?: string;
  organizationId?: string;
  contextEntities?: Array<{ type: string; id: number }>;
  abortSignal?: AbortSignal;
}

/**
 * Build a Sandbox instance from configurable context.
 * - If `spriteName` is present in config, returns a SpriteSandbox (remote exec)
 * - Otherwise returns a LocalSandbox (local Node.js exec)
 */
function buildSandbox(c: Record<string, unknown>): Sandbox {
  const spriteName = c['spriteName'] as string | undefined;
  const workingDir = (c['workingDirectory'] as string | undefined) ?? WORKING_DIR;

  if (spriteName) {
    const token = (c['spritesToken'] as string | undefined) ?? process.env.SPRITES_TOKEN ?? '';
    return new SpriteSandbox(workingDir, spriteName, token);
  }

  return new LocalSandbox(workingDir);
}

/** Extract tool context from a LangChain RunnableConfig. */
export function getContextFromConfig(config?: RunnableConfig): ToolContext {
  const c = (config?.configurable ?? {}) as Record<string, unknown>;
  const s = ((config as any)?.state ?? {}) as Record<string, unknown>;
  const workingDirectory = String(c['workingDirectory'] ?? s['workingDirectory'] ?? WORKING_DIR);

  return {
    sandbox: buildSandbox({ ...c, workingDirectory }),
    workingDirectory,
    userId: String(c['userId'] ?? s['userId'] ?? ''),
    organizationId: String(c['organizationId'] ?? s['organizationId'] ?? ''),
    contextEntities: (c['contextEntities'] ?? s['contextEntities'] ?? []) as Array<{ type: string; id: number }>,
  };
}
