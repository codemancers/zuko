import type { BaseLanguageModel } from '@langchain/core/language_models/base';
import { createDeepAgent } from 'deepagents';
import type { Tool } from 'langchain';

import { createPersistentContextMiddleware } from './middleware/persistent-context.middleware';
import { SYSTEM_PROMPT } from './shared/prompts';

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

export interface BuildChatGraphOpts {
  selectedModelId?: string;
  systemPrompt?: string;
  apiKey?: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildChatGraph(opts: BuildChatGraphOpts = {}): any {
  const modelId =
    opts.selectedModelId ??
    process.env.AGENT_MODEL ??
    `openai/${process.env.OPENAI_MODEL ?? 'gpt-4.1'}`;

  const model = selectModel({
    kind: 'chat-deepagents',
    selectedModelId: modelId,
    apiKey: opts.apiKey,
  }) as BaseLanguageModel;

  const crmTools = [
    ...companyTools,
    ...contactTools,
    ...dealTools,
    ...contextTools,
  ] as unknown as Tool[];

  const newTools = toLangChainTools(chatToolset) as unknown as Tool[];

  return createDeepAgent({
    model: model as any,
    systemPrompt: opts.systemPrompt ?? SYSTEM_PROMPT,
    tools: [...crmTools, ...newTools] as any,
    middleware: [createPersistentContextMiddleware() as any],
    subagents: [
      initializeContactsSubAgent(),
      initializeCompaniesSubAgent(),
      initializeDealsSubAgent(),
      initializeMeetingsSubAgent(),
    ],
  });
}
