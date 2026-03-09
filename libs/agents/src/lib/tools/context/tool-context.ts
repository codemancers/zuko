import type { ContextEntityReference } from '../../types/chat.types';

/**
 * Runtime config that may be passed when a tool is invoked from a graph.
 * LangGraph can inject state/config so tools can read contextEntities and organizationId.
 */
export type ToolRunConfig = {
  configurable?: {
    contextEntities?: ContextEntityReference[];
    organizationId?: number;
  };
  state?: {
    contextEntities?: ContextEntityReference[];
    organizationId?: number;
  };
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

/**
 * Get active organization ID from LangGraph tool invocation config.
 * Set by the chat controller from the user's session (active organization).
 * Required for all sales entity operations (contacts, companies, deals).
 */
export function getOrganizationId(config: unknown): number | undefined {
  const c = config as ToolRunConfig | undefined;
  return c?.state?.organizationId ?? c?.configurable?.organizationId;
}
