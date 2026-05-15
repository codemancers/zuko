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
  agentId?: number;
  capabilities?: string[];
}

/**
 * Build a Sandbox from configurable context.
 * - If a Sandbox instance is passed directly (gather-style, in-process agent) → use it
 * - If spriteName string is passed → construct SpriteSandbox
 * - Otherwise → LocalSandbox for local dev
 */
function buildSandbox(c: Record<string, unknown>): Sandbox {
  // Gather-style: sandbox instance passed directly in configurable
  if (c['sandbox'] && typeof (c['sandbox'] as any).exec === 'function') {
    return c['sandbox'] as Sandbox;
  }

  const spriteName = c['spriteName'] as string | undefined;
  const workingDir =
    (c['workingDirectory'] as string | undefined) ?? WORKING_DIR;

  if (spriteName) {
    const token =
      (c['spritesToken'] as string | undefined) ??
      process.env.SPRITES_TOKEN ??
      '';
    return new SpriteSandbox(workingDir, spriteName, token);
  }

  return new LocalSandbox(workingDir);
}

/** Extract tool context from a LangChain RunnableConfig. */
export function getContextFromConfig(config?: RunnableConfig): ToolContext {
  const c = (config?.configurable ?? {}) as Record<string, unknown>;
  const s = ((config as any)?.state ?? {}) as Record<string, unknown>;
  const workingDirectory = String(
    c['workingDirectory'] ?? s['workingDirectory'] ?? WORKING_DIR,
  );

  const rawAgentId = c['agentId'] ?? s['agentId'];
  const agentId =
    rawAgentId != null && rawAgentId !== '' ? Number(rawAgentId) : undefined;

  return {
    sandbox: buildSandbox({ ...c, workingDirectory }),
    workingDirectory,
    userId: String(c['userId'] ?? s['userId'] ?? ''),
    organizationId: String(c['organizationId'] ?? s['organizationId'] ?? ''),
    contextEntities: (c['contextEntities'] ??
      s['contextEntities'] ??
      []) as Array<{ type: string; id: number }>,
    agentId: Number.isFinite(agentId) ? agentId : undefined,
    capabilities: (c['capabilities'] ?? s['capabilities'] ?? undefined) as
      | string[]
      | undefined,
  };
}
