import { Injectable, Logger } from '@nestjs/common';
import { createDeepAgent } from 'deepagents';
import { ChatOpenAI } from '@langchain/openai';

type DeepAgent = ReturnType<typeof createDeepAgent>;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private agent?: DeepAgent;

  getAgent(): DeepAgent {
    if (this.agent) {
      return this.agent;
    }

    const systemPrompt =
      process.env.AGENTS_ADMIN_PROMPT ??
      [
        'You are the Admin agent.',
        'Handle requests about bringing medicines, coffee, or breakfast.',
        'Keep responses concise and helpful.',
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

    this.agent = createDeepAgent({
      model,
      systemPrompt,
      tools: [],
    });

    return this.agent;
  }
}
