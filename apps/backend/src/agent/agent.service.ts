import { Injectable } from '@nestjs/common';
import type { BaseMessageLike } from '@langchain/core/messages';
import type { ContextEntityReference } from '../types/chat';
import type { Sandbox } from './tools/sandbox';
import { AgentAuthBridgeService } from '../app/agent-auth-bridge/agent-auth-bridge.service';
import { buildChatGraph } from './build-graph';

export interface AgentStreamParams {
  messages: BaseMessageLike[];
  contextEntities: ContextEntityReference[];
  userId: number;
  organizationId: number | null;
  sandbox: Sandbox;
  signal?: AbortSignal;
  agentId?: number;
  capabilities?: string[];
}

@Injectable()
export class AgentService {
  constructor(private readonly agentAuthBridge: AgentAuthBridgeService) {}

  /**
   * Runs the chat graph in-process and returns an async iterable of stream chunks.
   * The sandbox instance is passed directly in configurable (gather-style).
   * signJwt is bound to the chat's delegated agent and passed through configurable
   * so tools can sign JWTs locally without any HTTP round-trip.
   */
  async stream(params: AgentStreamParams): Promise<AsyncIterable<any>> {
    const {
      messages,
      contextEntities,
      userId,
      organizationId,
      sandbox,
      signal,
      agentId,
      capabilities,
    } = params;

    const signJwt = (caps: string[]) =>
      this.agentAuthBridge.signAgentJWT({
        agentId: agentId!,
        capabilities: caps,
      });

    const graph = buildChatGraph();

    return (graph as any).stream(
      { messages, contextEntities, userId, organizationId },
      {
        configurable: {
          sandbox,
          userId: String(userId),
          organizationId: organizationId != null ? String(organizationId) : '',
          contextEntities,
          signJwt,
          ...(agentId != null ? { agentId } : {}),
          ...(capabilities != null ? { capabilities } : {}),
        },
        streamMode: ['values', 'messages'],
        signal,
      },
    );
  }
}
