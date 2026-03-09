import type { BaseMessageLike } from '@langchain/core/messages';

export type { BaseMessageLike };

export type ChatCompletionRequest = {
  model?: string;
  messages?: BaseMessageLike[];
  thread_id?: string;
};

/**
 * Entity reference for chat context
 * Stores minimal identifier to be persisted in LangGraph checkpoints
 */
export interface ContextEntityReference {
  type: 'contact' | 'company' | 'deal';
  id: number;
}

/**
 * message metadata
 */
export interface MessageMetadata {
  contextEntities?: ContextEntityReference[];
}

/**
 * LangGraph agent state schema
 * This is the state that gets persisted in PostgreSQL checkpoints
 */
export interface AgentState {
  messages: BaseMessageLike[];
  /**
   * Context entities available in this conversation
   * Stores minimal references that can be hydrated on-demand using tools
   */
  contextEntities?: ContextEntityReference[];
  /**
   * ID of the authenticated user who initiated this conversation
   * Used for attributing actions (e.g., comments) to the correct user
   */
  userId?: number;
  /**
   * Active organization ID from the user's session.
   * Scopes all sales operations (contacts, companies, deals) to this organization.
   */
  organizationId?: number;
}
