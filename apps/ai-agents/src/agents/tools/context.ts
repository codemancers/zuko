import type { RunnableConfig } from '@langchain/core/runnables';

/** Default working directory inside the sprite. */
export const WORKING_DIR = process.env.WORKING_DIR ?? '/home/sprite/zuko';

export interface ToolContext {
  workingDirectory?: string;
  userId?: string;
  organizationId?: string;
  contextEntities?: Array<{ type: string; id: number }>;
  abortSignal?: AbortSignal;
}

/** Extract user/org context from a LangChain RunnableConfig. */
export function getContextFromConfig(config?: RunnableConfig): ToolContext {
  const c = (config?.configurable ?? {}) as Record<string, unknown>;
  const s = ((config as any)?.state ?? {}) as Record<string, unknown>;
  return {
    workingDirectory: String(c['workingDirectory'] ?? s['workingDirectory'] ?? WORKING_DIR),
    userId: String(c['userId'] ?? s['userId'] ?? ''),
    organizationId: String(c['organizationId'] ?? s['organizationId'] ?? ''),
    contextEntities: (c['contextEntities'] ?? s['contextEntities'] ?? []) as Array<{ type: string; id: number }>,
  };
}
