// @ts-nocheck - Pre-existing type incompatibilities with deepagents library that need to be resolved
import { Injectable, Logger } from '@nestjs/common';
import { createDeepAgent, type CompiledSubAgent } from 'deepagents';
import { ChatOpenAI } from '@langchain/openai';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { randomUUID } from 'node:crypto';
import type { AgentRequest, AgentResponse } from '../types/agents.types';
import type { BaseMessageLike, ContextEntityReference } from '../types/chat.types';
import type { GraphStreamMode } from '../types/graph.types';
import { AdminService } from './admin.service';
// PrismaService should be provided by the consuming application
import type { PrismaService } from '../modules/prisma.types';
// Import tool creators
import {
  createGetContactDetailsTool,
  createGetContactOwnerTool,
  createGetAccountDetailsTool,
  createLeaveCommentTool,
  createQueryContactsTool,
  createQueryAccountsTool,
  createQueryActivitiesTool,
} from '../tools';
// Import services from @zuko/sales
import type { ContactsService, AccountsService, ActivityService } from '@zuko/sales';
// Import persistent context middleware
import { createPersistentContextMiddleware } from '../middleware/persistent-context.middleware';

type DeepAgent = ReturnType<typeof createDeepAgent>;

const extractTextFromContent = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }
        if (item && typeof item === 'object') {
          const block = item as { text?: unknown; content?: unknown };
          if (typeof block.text === 'string') {
            return block.text;
          }
          if (
            block.text &&
            typeof block.text === 'object' &&
            typeof (block.text as { value?: unknown }).value === 'string'
          ) {
            return (block.text as { value?: string }).value ?? '';
          }
          if (typeof block.content === 'string') {
            return block.content;
          }
        }
        return '';
      })
      .join('');
  }
  return '';
};

const extractTextFromMessage = (value: unknown): string => {
  if (!value || typeof value !== 'object') {
    return '';
  }
  const msg = value as {
    content?: unknown;
    delta?: { content?: unknown };
    kwargs?: { content?: unknown };
    lc_kwargs?: { content?: unknown };
    text?: unknown;
  };
  return (
    extractTextFromContent(msg.content) ||
    extractTextFromContent(msg.delta?.content) ||
    extractTextFromContent(msg.kwargs?.content) ||
    extractTextFromContent(msg.lc_kwargs?.content) ||
    extractTextFromContent(msg.text)
  );
};

// Persistent context fields (contextEntities, userId) are now handled by
// createPersistentContextMiddleware instead of a separate Annotation schema

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);
  private agent?: DeepAgent;
  private agentPromise?: Promise<DeepAgent>;
  private checkpointer?: PostgresSaver;
  private checkpointerPromise?: Promise<PostgresSaver>;

  constructor(
    private readonly adminService: AdminService,
    private readonly prisma: PrismaService,
    private readonly contactsService: ContactsService,
    private readonly accountsService: AccountsService,
    private readonly activityService: ActivityService
  ) {}

  private async ensureAgent(): Promise<DeepAgent> {
    if (this.agent) {
      return this.agent;
    }

    if (this.agentPromise) {
      return this.agentPromise;
    }

    const secretaryDisabled = process.env.AGENTS_DISABLE_SECRETARY === 'true';
    if (secretaryDisabled) {
      this.logger.warn('AGENTS_DISABLE_SECRETARY=true; skipping secretary agent initialization.');
    }

    const systemPrompt =
      process.env.AGENTS_SYSTEM_PROMPT ??
      [
        'You are an AI assistant orchestrator.',
        'Decide whether to answer directly or delegate to specialized agents.',
        '',
        'Context available in state:',
        '- userId: The authenticated user ID (use this when calling leave_comment)',
        '- contextEntities: Array of entity references (contacts, accounts, deals) added to conversation',
        '',
        'Tools available:',
        '- get_contact_details: Retrieve full contact information by ID',
        '- get_contact_owner: Get the owner(s) of a contact',
        '- get_account_details: Retrieve account/company information by ID',
        '- leave_comment: Add a comment to a contact, account, or deal (MUST pass userId from state)',
        '',
        'Query tools for analytical questions:',
        '- query_contacts: Filter and aggregate contacts with flexible criteria',
        '- query_accounts: Filter and aggregate accounts/companies',
        '- query_activities: Search activity timeline (comments, updates, etc.)',
        '',
        'Delegation:',
        '- Delegate requests about bringing medicines, coffee, or breakfast to the admin agent.',
        ...(secretaryDisabled
          ? []
          : ['- Delegate requests about booking meetings, scheduling, or calendar events to the secretary agent.']),
        '',
        'For all other questions, use the available tools or respond directly and concisely.',
      ].join('\n');

    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn('OPENAI_API_KEY is not configured; DeepAgent may fail to respond.');
    }

    const model = new ChatOpenAI({
      model: process.env.AGENTS_LLM_MODEL ?? 'gpt-4o',
      temperature: 0.2,
    });

    this.agentPromise = (async () => {
      const checkpointer = await this.ensureCheckpointer();

      const adminSubagent: CompiledSubAgent = {
        name: 'admin-agent',
        description: 'Handles requests to bring medicines, coffee, or breakfast.',
        runnable: this.adminService.getAgent(),
      };

      // Secretary agent is disabled (removed from codebase)
      const secretarySubagent = undefined;

      // Create Tier 1 tools
      const tier1Tools = [
        createGetContactDetailsTool(this.contactsService),
        createGetContactOwnerTool(this.contactsService),
        createGetAccountDetailsTool(this.accountsService),
        createLeaveCommentTool(this.activityService),
      ];

      // Create Tier 2 tools
      const tier2Tools = [
        createQueryContactsTool(this.contactsService),
        createQueryAccountsTool(this.accountsService),
        createQueryActivitiesTool(this.activityService),
      ];

      // Combine all tools
      const allTools = [...tier1Tools, ...tier2Tools];

      this.agent = createDeepAgent({
        model,
        systemPrompt,
        tools: allTools,
        subagents: secretarySubagent ? [adminSubagent, secretarySubagent] : [adminSubagent],
        checkpointer,
        middleware: [createPersistentContextMiddleware()],
      });

      return this.agent;
    })();

    return this.agentPromise;
  }

  private async ensureCheckpointer(): Promise<PostgresSaver> {
    if (this.checkpointer) {
      return this.checkpointer;
    }

    if (this.checkpointerPromise) {
      return this.checkpointerPromise;
    }

    this.checkpointerPromise = (async () => {
      const checkpointer = new PostgresSaver(this.prisma.getPool(), undefined, {
        schema: 'agents',
      });
      await checkpointer.setup();
      this.checkpointer = checkpointer;
      return checkpointer;
    })();

    return this.checkpointerPromise;
  }

  async initThread(request: { threadId?: string }) {
    const threadId = request.threadId ?? randomUUID();
    const agent = await this.ensureAgent();
    const checkpointer = await this.ensureCheckpointer();
    const config = { configurable: { thread_id: threadId } };

    await agent.invoke(
      { messages: [{ role: 'user', content: 'Initialize thread.' }] },
      config
    );

    let checkpointId: string | undefined;
    for await (const checkpoint of checkpointer.list(config)) {
      checkpointId = (checkpoint as { id?: string }).id ?? checkpointId;
    }

    return { threadId, checkpointId };
  }

  async respond(request: AgentRequest): Promise<AgentResponse> {
    const agent = await this.ensureAgent();
    const prompt = request.text?.trim() || 'Respond to the latest event.';
    const threadId = request.threadTs;

    const config = threadId ? { configurable: { thread_id: threadId } } : undefined;

    const result = await agent.invoke(
      { messages: [{ role: 'user', content: prompt }] },
      config
    );

    const lastMessage = result.messages[result.messages.length - 1];
    const content =
      typeof lastMessage?.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage?.content ?? '');

    return {
      text: content,
      channelId: request.channelId,
      threadTs: request.threadTs,
    };
  }

  async generateReply(messages: BaseMessageLike[], threadId: string): Promise<string> {
    const agent = await this.ensureAgent();
    const config = threadId ? { configurable: { thread_id: threadId } } : undefined;
    const result = await agent.invoke({ messages }, config);
    const lastMessage = result.messages[result.messages.length - 1];
    return typeof lastMessage?.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage?.content ?? '');
  }

  async *streamReply(messages: BaseMessageLike[], threadId: string): AsyncGenerator<string> {
    const agent = await this.ensureAgent();
    const config = threadId
      ? { streamMode: 'messages', configurable: { thread_id: threadId } }
      : { streamMode: 'messages' };
    const stream = await agent.stream({ messages }, config);
    let lastText = '';
    for await (const chunk of stream as AsyncIterable<unknown>) {
      if (Array.isArray(chunk) && chunk.length >= 1) {
        const [message, metadata] = chunk;
        const currentText = extractTextFromMessage(message);
        if (!currentText) {
          continue;
        }
        const delta = currentText.startsWith(lastText) ? currentText.slice(lastText.length) : currentText;
        if (!delta) {
          continue;
        }
        lastText = currentText;
        yield JSON.stringify({ text: delta, metadata });
        continue;
      }

      if (chunk && typeof chunk === 'object') {
        const currentText = extractTextFromMessage(chunk);
        if (!currentText) {
          continue;
        }
        const delta = currentText.startsWith(lastText) ? currentText.slice(lastText.length) : currentText;
        if (!delta) {
          continue;
        }
        lastText = currentText;
        yield JSON.stringify({ text: delta });
      }
    }
  }

  async *streamGraph(
    input: unknown,
    config?: Record<string, unknown>,
    streamMode?: GraphStreamMode | GraphStreamMode[]
  ): AsyncGenerator<unknown> {
    const agent = await this.ensureAgent();
    const options: Record<string, unknown> = { ...(config ?? {}) };
    if (typeof streamMode !== 'undefined') {
      options.streamMode = streamMode;
    }
    const stream = await agent.stream(input as unknown, options as Record<string, unknown>);
    for await (const chunk of stream as AsyncIterable<unknown>) {
      yield chunk;
    }
  }

  /**
   * Get message history and context entities from checkpoint state for a given threadId
   */
  async getMessages(threadId: string): Promise<{
    messages: Array<{ role: string; content: string }>;
    contextEntities?: Array<ContextEntityReference & { name: string }>;
  }> {
    const checkpointer = await this.ensureCheckpointer();
    const config = { configurable: { thread_id: threadId } };

    try {
      // Get the latest checkpoint state
      const state = await checkpointer.getTuple(config);

      if (!state || !state.checkpoint || !state.checkpoint.channel_values) {
        return { messages: [], contextEntities: [] };
      }

      // Extract messages and contextEntities from the checkpoint state
      const channelValues = state.checkpoint.channel_values as {
        messages?: unknown[];
        contextEntities?: ContextEntityReference[];
      };
      const messages = channelValues.messages || [];
      const contextEntities = channelValues.contextEntities || [];

      // Convert to simple message format
      const formattedMessages = messages
        .map((msg: any) => ({
          role: msg.type === 'human' ? 'user' : msg.type === 'ai' ? 'assistant' : msg.type,
          content: typeof msg.content === 'string' ? msg.content : extractTextFromMessage(msg),
        }))
        .filter((msg) => msg.content && msg.content.trim().length > 0);

      // Hydrate contextEntities with names from database
      const hydratedEntities = await Promise.all(
        contextEntities.map(async (entity) => {
          try {
            if (entity.type === 'contact' && this.contactsService) {
              const contact = await this.contactsService.findOne(entity.id);
              return { ...entity, name: `${contact.firstName} ${contact.lastName}`.trim() };
            } else if (entity.type === 'account' && this.accountsService) {
              const account = await this.accountsService.findOne(entity.id);
              return { ...entity, name: account.name };
            } else if (entity.type === 'deal') {
              // TODO: Add deal service when available
              return { ...entity, name: `Deal #${entity.id}` };
            }
            return { ...entity, name: `${entity.type} #${entity.id}` };
          } catch (error) {
            this.logger.warn(`Failed to hydrate ${entity.type} ${entity.id}:`, error);
            return { ...entity, name: `${entity.type} #${entity.id}` };
          }
        })
      );

      return {
        messages: formattedMessages,
        contextEntities: hydratedEntities,
      };
    } catch (error) {
      this.logger.error(`Failed to get messages for thread ${threadId}:`, error);
      return { messages: [], contextEntities: [] };
    }
  }
}
