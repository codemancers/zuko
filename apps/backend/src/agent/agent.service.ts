import { Injectable } from '@nestjs/common';
import type { BaseMessageLike } from '@langchain/core/messages';
import type { ContextEntityReference } from '../types/chat';
import type { Sandbox } from './tools/sandbox';
import { buildChatGraph } from './build-graph';

export interface AgentStreamParams {
  messages: BaseMessageLike[];
  contextEntities: ContextEntityReference[];
  userId: number;
  organizationId: number | null;
  sandbox: Sandbox;
}

@Injectable()
export class AgentService {
  /**
   * Runs the chat graph in-process and returns an async iterable of stream chunks.
   * The sandbox instance is passed directly in configurable (gather-style).
   */
  async stream(params: AgentStreamParams): Promise<AsyncIterable<any>> {
    const { messages, contextEntities, userId, organizationId, sandbox } =
      params;

    const graph = buildChatGraph();

    return (graph as any).stream(
      { messages, contextEntities, userId, organizationId },
      {
        configurable: {
          sandbox,
          userId: String(userId),
          organizationId: organizationId != null ? String(organizationId) : '',
          contextEntities,
        },
        streamMode: ['values', 'messages'],
      },
    );
  }
}
