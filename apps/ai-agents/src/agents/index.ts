import { ChatOpenAI } from "@langchain/openai";
import {  SubAgent, createDeepAgent } from "deepagents";
import { Tool } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

import { createPersistentContextMiddleware } from "../middleware";
import { SYSTEM_PROMPT } from "../shared/prompts";

type DeepAgent = ReturnType<typeof createDeepAgent>;


export async function initializeAgent(
  tools: Tool[],
  subAgents: SubAgent[],
  modelName?: string
): Promise<DeepAgent> {
  const systemPrompt = SYSTEM_PROMPT;
  const OPENAI_MODEL = process.env.OPENAI_MODEL || modelName || "gpt-4.1";
  const model = new ChatOpenAI({
    model: OPENAI_MODEL,
  });
  const checkpointer = new MemorySaver();

  const agent = createDeepAgent({
    model,
    systemPrompt,
    tools,
    checkpointer,
    middleware: [createPersistentContextMiddleware()],
    subagents: subAgents,
  });

  return agent;
}

export const agent = (async () => {
  const tools: Tool[] = [];

  return await initializeAgent(tools, []);
})();