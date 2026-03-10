/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Pre-existing type incompatibilities with deepagents library that need to be resolved
import { Injectable, Logger } from '@nestjs/common';
import { createDeepAgent, type CompiledSubAgent } from 'deepagents';
import { ChatOpenAI } from '@langchain/openai';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { randomUUID } from 'node:crypto';
import type { AgentRequest, AgentResponse } from '../types/agents.types';
import type {
  BaseMessageLike,
  ContextEntityReference,
} from '../types/chat.types';
import type { GraphStreamMode } from '../types/graph.types';
import { AdminService } from './admin.service';
// PrismaService should be provided by the consuming application
import type { PrismaService } from '../modules/prisma.types';
// Import tool creators
import {
  createGetConversationContextTool,
  createCreateContactTool,
  createGetContactDetailsTool,
  createGetContactOwnerTool,
  createCreateCompanyTool,
  createGetCompanyDetailsTool,
  createGetDealDetailsTool,
  createUpdateContactTool,
  createUpdateCompanyTool,
  createUpdateDealTool,
  createLeaveCommentTool,
  createQueryContactsTool,
  createQueryCompaniesTool,
  createQueryDealsTool,
  createQueryActivitiesTool,
} from '../tools';
// Import services from @zuko/sales
import type {
  ContactsService,
  CompaniesService,
  DealsService,
  ActivityService,
} from '@zuko/sales';
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
    private readonly companiesService: CompaniesService,
    private readonly dealsService: DealsService,
    private readonly activityService: ActivityService,
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
      this.logger.warn(
        'AGENTS_DISABLE_SECRETARY=true; skipping secretary agent initialization.',
      );
    }

    const systemPrompt =
      process.env.AGENTS_SYSTEM_PROMPT ??
      [
        'You are an AI assistant orchestrator.',
        'Decide whether to answer directly or delegate to specialized agents.',
        '',
        'Context available in state:',
        '- userId: The authenticated user ID (use this when calling leave_comment)',
        '- contextEntities: Array of entity references (contacts, companies, deals) the user added to the conversation (e.g. via the + button)',
        '',
        'When there is a mix of contacts, companies, or deals in context, call get_conversation_context first to see the list, then call the required detail or query tools (get_contact_details, get_company_details, get_deal_details, query_contacts, query_companies, query_deals) as needed.',
        '',
        "Updates: When the user asks to change or update contact, company, or deal data (e.g. 'change this person's email to X', 'update deal status to closed', 'set company website to Y'), use update_contact, update_company, or update_deal with the relevant fields. Resolve the entity from context when one is in context; then confirm to the user what was updated.",
        '',
        'IMPORTANT - When the user asks for company, contact, or deal details:',
        '- ALWAYS call the relevant tool (get_contact_details, get_company_details, get_deal_details, query_contacts, query_companies, or query_deals). Do not skip the tool or ask the user for an ID.',
        '- All entity IDs are optional. Tools resolve the entity from contextEntities when no ID is passed. If the user or context provides an ID, you may pass it.',
        '- One entity in context: call get_company_details, get_contact_details, or get_deal_details with no arguments (tool uses context).',
        '- Multiple entities in context: use query_companies with filters.companyIds, query_contacts with filters.contactIds, or query_deals with filters.dealIds.',
        '- After calling a tool, always respond to the user with the result; do not leave the user without a reply.',
        '',
        'Tools (IDs are always optional; context from contextEntities is used when ID is omitted):',
        '- get_conversation_context: Returns the current context (list of contacts, companies, deals in this conversation). Call to see what is in context before calling other tools. No arguments.',
        '- create_contact: Create a new contact. Use when user asks to "create/add a contact". Requires name and email; owner defaults to the authenticated user.',
        '- get_contact_details: Full contact info. Call with no args when one contact in context; optional contactId if user provided an ID.',
        '- get_contact_owner: Owner(s) of a contact. Optional contactId; uses context when one contact in context.',
        '- create_company: Create a new company. Use when user asks to "create/add a company". Requires companyName and website; owner defaults to the authenticated user.',
        '- get_company_details: Company info. Call with no args when one company in context; optional companyId if user provided an ID.',
        '- get_deal_details: Deal info (title, value, stage, owners, companies, contacts). Call with no args when one deal in context; optional dealId if user provided an ID.',
        "- update_contact: Update contact fields (name, email, phone, linkedinId, notes). Use when user says e.g. 'change their email to X', 'update phone to Y'. Optional contactId; uses context when one contact in context. Returns updated contact for confirmation.",
        '- update_company: Update company fields (companyName, website, linkedinUrl, summary). Optional companyId; uses context when one company in context. Returns updated company for confirmation.',
        "- update_deal: Update deal fields (title, value, stage, probability, summary, expectedCloseDate, actualCloseDate, etc.). Use when user says e.g. 'update deal status to closed', 'set value to 5000'. Optional dealId; uses context when one deal in context. Returns updated deal for confirmation.",
        '- leave_comment: Add a comment (MUST pass userId from state)',
        '',
        'Query tools:',
        '- query_contacts: Filter/aggregate contacts; use filters.contactIds for multiple IDs from context',
        '- query_companies: Filter/aggregate companies; use filters.companyIds for multiple IDs from context',
        '- query_deals: Filter/aggregate deals; use filters.dealIds for multiple IDs from context',
        '- query_activities: Search activity timeline',
        '',
        'Delegation:',
        '- Delegate requests about bringing medicines, coffee, or breakfast to the admin agent.',
        ...(secretaryDisabled
          ? []
          : [
              '- Delegate requests about booking meetings, scheduling, or calendar events to the secretary agent.',
            ]),
        '',
        'For all other questions, use the available tools or respond directly and concisely.',
      ].join('\n');

    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn(
        'OPENAI_API_KEY is not configured; DeepAgent may fail to respond.',
      );
    }

    const model = new ChatOpenAI({
      model: process.env.AGENTS_LLM_MODEL ?? 'gpt-4o',
      temperature: 0.2,
    });

    this.agentPromise = (async () => {
      const checkpointer = await this.ensureCheckpointer();

      const adminSubagent: CompiledSubAgent = {
        name: 'admin-agent',
        description:
          'Handles requests to bring medicines, coffee, or breakfast.',
        runnable: this.adminService.getAgent(),
      };

      // Secretary agent is disabled (removed from codebase)
      const secretarySubagent = undefined;

      const tier1Tools = [
        createGetConversationContextTool(),
        createCreateContactTool(this.contactsService),
        createGetContactDetailsTool(this.contactsService),
        createGetContactOwnerTool(this.contactsService),
        createCreateCompanyTool(this.companiesService),
        createGetCompanyDetailsTool(this.companiesService),
        createGetDealDetailsTool(this.dealsService),
        createUpdateContactTool(this.contactsService),
        createUpdateCompanyTool(this.companiesService),
        createUpdateDealTool(this.dealsService),
        createLeaveCommentTool(this.activityService),
      ];

      // Create Tier 2 tools
      const tier2Tools = [
        createQueryContactsTool(this.contactsService),
        createQueryCompaniesTool(this.companiesService),
        createQueryDealsTool(this.dealsService),
        createQueryActivitiesTool(this.activityService),
      ];

      // Combine all tools
      const allTools = [...tier1Tools, ...tier2Tools];

      this.agent = createDeepAgent({
        model,
        systemPrompt,
        tools: allTools,
        subagents: secretarySubagent
          ? [adminSubagent, secretarySubagent]
          : [adminSubagent],
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
      try {
        await checkpointer.setup();
      } catch (err: unknown) {
        // Ignore duplicate key errors — this means the schema was already
        // initialized (e.g. in a previous run or during parallel test setup).
        const pgErr = err as { code?: string };
        if (pgErr?.code !== '23505') {
          throw err;
        }
        this.logger.debug(
          'PostgresSaver.setup(): checkpoint_migrations already initialized, skipping.',
        );
      }
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
      config,
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

    const config = threadId
      ? { configurable: { thread_id: threadId } }
      : undefined;

    const result = await agent.invoke(
      { messages: [{ role: 'user', content: prompt }] },
      config,
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

  async generateReply(
    messages: BaseMessageLike[],
    threadId: string,
  ): Promise<string> {
    const agent = await this.ensureAgent();
    const config = threadId
      ? { configurable: { thread_id: threadId } }
      : undefined;
    const result = await agent.invoke({ messages }, config);
    const lastMessage = result.messages[result.messages.length - 1];
    return typeof lastMessage?.content === 'string'
      ? lastMessage.content
      : JSON.stringify(lastMessage?.content ?? '');
  }

  async *streamReply(
    messages: BaseMessageLike[],
    threadId: string,
  ): AsyncGenerator<string> {
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
        const delta = currentText.startsWith(lastText)
          ? currentText.slice(lastText.length)
          : currentText;
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
        const delta = currentText.startsWith(lastText)
          ? currentText.slice(lastText.length)
          : currentText;
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
    streamMode?: GraphStreamMode | GraphStreamMode[],
  ): AsyncGenerator<unknown> {
    const agent = await this.ensureAgent();
    const options: Record<string, unknown> = { ...(config ?? {}) };
    if (typeof streamMode !== 'undefined') {
      options.streamMode = streamMode;
    }
    const stream = await agent.stream(
      input as unknown,
      options as Record<string, unknown>,
    );
    for await (const chunk of stream as AsyncIterable<unknown>) {
      yield chunk;
    }
  }

  /**
   * Get message history and context entities from checkpoint state for a given threadId
   */
  async getMessages(threadId: string): Promise<{
    messages: Array<{ role: string; content: string }>;
    contextEntities: Array<ContextEntityReference & { name: string }>;
  }> {
    const checkpointer = await this.ensureCheckpointer();
    const config = { configurable: { thread_id: threadId } };

    try {
      // Get the latest checkpoint state
      const state = await checkpointer.getTuple(config);

      if (!state || !state.checkpoint || !state.checkpoint.channel_values) {
        return { messages: [], contextEntities: [] };
      }

      // Extract messages, contextEntities, and organizationId from the checkpoint state
      const channelValues = state.checkpoint.channel_values as {
        messages?: unknown[];
        contextEntities?: ContextEntityReference[];
        organizationId?: number;
      };
      const messages = channelValues.messages || [];
      const contextEntities = channelValues.contextEntities || [];
      const organizationId = channelValues.organizationId;

      // Convert to simple message format
      const formattedMessages = messages
        .map((msg: any) => ({
          role:
            msg.type === 'human'
              ? 'user'
              : msg.type === 'ai'
                ? 'assistant'
                : msg.type,
          content:
            typeof msg.content === 'string'
              ? msg.content
              : extractTextFromMessage(msg),
        }))
        .filter((msg) => msg.content && msg.content.trim().length > 0);

      // Without organizationId we cannot hydrate contextEntities (org-scoped findById); do not proceed
      if (organizationId === undefined) {
        return {
          messages: formattedMessages,
          contextEntities: [],
        };
      }

      // Hydrate contextEntities with names from database
      const hydratedEntities = await Promise.all(
        contextEntities.map(async (entity) => {
          try {
            if (entity.type === 'contact' && this.contactsService) {
              const contact = await this.contactsService.findById(
                entity.id,
                organizationId,
              );
              const name = (contact as any).name ?? 'Contact';
              return { ...entity, name };
            }
            if (entity.type === 'company' && this.companiesService) {
              const company = await this.companiesService.findById(
                entity.id,
                organizationId,
              );
              return {
                ...entity,
                name: (company as any).companyName ?? 'Company',
              };
            }
            if (entity.type === "deal" && this.dealsService) {
              const deal = await this.dealsService.findById(entity.id);
              const name = (deal as any).title ?? `Deal #${entity.id}`;
              return { ...entity, name };
            }
            return { ...entity, name: 'Contact' };
          } catch (error) {
            this.logger.warn(
              `Failed to hydrate ${entity.type} ${entity.id}:`,
              error,
            );
            return {
              ...entity,
              name:
                entity.type === 'contact'
                  ? 'Contact'
                  : entity.type === 'company'
                    ? 'Company'
                    : 'Deal',
            };
          }
        }),
      );

      return {
        messages: formattedMessages,
        contextEntities: hydratedEntities,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get messages for thread ${threadId}:`,
        error,
      );
      return { messages: [], contextEntities: [] };
    }
  }
}
