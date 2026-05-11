import type { ToolDef } from './base';

import { readTool } from './read';
import { writeTool } from './write';
import { editTool } from './edit';
import { statTool } from './stat';
import { mkdirTool } from './mkdir';
import { readdirTool } from './readdir';
import { globTool } from './glob';
import { grepTool } from './grep';
import { bashTool } from './bash';
import { askUserQuestionTool } from './ask-user-question';
import { todoWriteTool } from './todo-write';
import { webFetchTool } from './web-fetch';

export const sharedTools: ToolDef<any, any>[] = [
  readTool,
  writeTool,
  editTool,
  statTool,
  mkdirTool,
  readdirTool,
  globTool,
  grepTool,
  bashTool,
  webFetchTool,
];

export const interactiveTools: ToolDef<any, any>[] = [
  askUserQuestionTool,
  todoWriteTool,
];

export const chatToolset: ToolDef<any, any>[] = [
  ...sharedTools,
  ...interactiveTools,
];

export { defineTool, type ToolDef } from './base';
export { type ToolContext, getContextFromConfig } from './context';
export { type Sandbox, LocalSandbox, SpriteSandbox } from './sandbox';
export { toLangChainTools } from './adapters/langchain';
