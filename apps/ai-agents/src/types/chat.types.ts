import type { BaseMessageLike } from '@langchain/core/messages';

export type { BaseMessageLike };
/**
 * Entity reference for chat context
 * Stores minimal identifier to be persisted in LangGraph checkpoints
 */
export interface ContextEntityReference {
  type: 'contact' | 'company' | 'deal';
  id: number;
}
