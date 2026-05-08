import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';

export type ModelKind = 'chat-deepagents';

export interface SelectModelInput {
  kind: ModelKind;
  /** e.g. "anthropic/claude-sonnet-4-5" or "openai/gpt-4.1" */
  selectedModelId: string;
  apiKey?: string;
}

/**
 * Resolves a selectedModelId to a LangChain chat model.
 * Format: "<provider>/<model>" e.g. "openai/gpt-4.1", "anthropic/claude-sonnet-4-5"
 */
export function selectModel(input: SelectModelInput) {
  const slashIdx = input.selectedModelId.indexOf('/');
  if (slashIdx === -1) {
    throw new Error(
      `selectModel: invalid selectedModelId "${input.selectedModelId}" — expected "<provider>/<model>"`,
    );
  }
  const provider = input.selectedModelId.slice(0, slashIdx);
  const modelId = input.selectedModelId.slice(slashIdx + 1);

  if (provider === 'anthropic') {
    return new ChatAnthropic({ model: modelId, apiKey: input.apiKey });
  }
  if (provider === 'openai') {
    return new ChatOpenAI({ model: modelId, apiKey: input.apiKey });
  }
  throw new Error(`selectModel: unknown provider "${provider}"`);
}
