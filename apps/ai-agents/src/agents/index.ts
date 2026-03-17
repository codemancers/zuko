import { ChatOpenAI } from "@langchain/openai";
import {  SubAgent, createDeepAgent } from "deepagents";
import { Tool } from "langchain";

import { createPersistentContextMiddleware } from "../middleware";
import { SYSTEM_PROMPT } from "../shared/prompts";

import { getCheckpointer } from "../shared/checkpointer";

import { companyTools } from "./tools/company.tools";
import { contactTools } from "./tools/contacts.tools";
import { contextTools } from "./tools/context.tools";
import { dealTools } from "./tools/deals.tools";

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

  const checkpointer = await getCheckpointer();

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
  const tools = [
    ...companyTools,
    ...contactTools,
    ...dealTools,
    ...contextTools,
  ] as unknown as Tool[];

  return await initializeAgent(tools, []);
})();
