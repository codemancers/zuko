import type { ContextEntityReference } from '../../types/chat.types';

/**
 * Runtime config that may be passed when a tool is invoked from a graph.
 * LangGraph can inject state/config so tools can read contextEntities.
 */
export type ToolRunConfig = {
  configurable?: { contextEntities?: ContextEntityReference[] };
  state?: { contextEntities?: ContextEntityReference[] };
};

/**
 * Get context entities from LangGraph tool invocation config.
 * Used by context-aware tools to resolve contact/company/deal from conversation context.
 */
export function getContextEntities(
  config: unknown,
): ContextEntityReference[] | undefined {
  const c = config as ToolRunConfig | undefined;
  return c?.state?.contextEntities ?? c?.configurable?.contextEntities;
}
