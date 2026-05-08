import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import type { SubAgent } from 'deepagents';
import { createDeepAgent } from 'deepagents';
import type { Tool } from 'langchain';

import { createPersistentContextMiddleware } from '../middleware';
import { SYSTEM_PROMPT } from '../shared/prompts';

import { companyTools } from './tools/company.tools';
import { contactTools } from './tools/contacts.tools';
import { contextTools } from './tools/context.tools';
import { dealTools } from './tools/deals.tools';

import { chatToolset, toLangChainTools } from './tools';
import { selectModel } from './models/select-model';
import { initializeContactsSubAgent } from './subagents/contacts';
import { initializeCompaniesSubAgent } from './subagents/companies';
import { initializeDealsSubAgent } from './subagents/deals';
import { initializeMeetingsSubAgent } from './subagents/meetings';

type DeepAgent = ReturnType<typeof createDeepAgent>;

export interface BuildChatGraphOpts {
  /** e.g. "openai/gpt-4.1" or "anthropic/claude-sonnet-4-5" */
  selectedModelId?: string;
  systemPrompt?: string;
  apiKey?: string;
}

/**
 * Builds a deepagents DeepAgent for chat turns.
 *
 * Uses createDeepAgent with:
 *   - LangChain model resolved via selectModel (supports OpenAI + Anthropic)
 *   - CRM tools (contacts, companies, deals, context) + shared tools (bash, fs, web_fetch, etc.)
 *   - Domain subagents: Contacts, Companies, Deals, Meetings
 *   - Persistent context middleware
 */
export function buildChatGraph(opts: BuildChatGraphOpts = {}): DeepAgent {
  const modelId =
    opts.selectedModelId ??
    process.env.AGENT_MODEL ??
    `openai/${process.env.OPENAI_MODEL ?? 'gpt-4.1'}`;

  const model = selectModel({
    kind: 'chat-deepagents',
    selectedModelId: modelId,
    apiKey: opts.apiKey,
  }) as BaseLanguageModel;

  // CRM tools (existing LangChain tools) + new shared tools via ToolDef adapter
  const crmTools = [
    ...companyTools,
    ...contactTools,
    ...dealTools,
    ...contextTools,
  ] as unknown as Tool[];

  const newTools = toLangChainTools(chatToolset) as unknown as Tool[];

  const prompt = opts.systemPrompt ?? SYSTEM_PROMPT;

  const subagents: SubAgent[] = [
    initializeContactsSubAgent(),
    initializeCompaniesSubAgent(),
    initializeDealsSubAgent(),
    initializeMeetingsSubAgent(),
  ];

  return createDeepAgent({
    model,
    systemPrompt: prompt,
    tools: [...crmTools, ...newTools],
    middleware: [createPersistentContextMiddleware() as any],
    subagents,
  });
}

// Default exported agent instance (used by LangGraph CLI server)
export const agent: Promise<DeepAgent> = Promise.resolve(buildChatGraph());
