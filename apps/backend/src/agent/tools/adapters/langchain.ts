import { tool as lcTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { ToolDef } from '../base';
import { getContextFromConfig } from '../context';

export function toLangChainTools(defs: ToolDef<any, any>[]) {
  return defs.map((def) =>
    lcTool(
      async (input: unknown, config?: RunnableConfig) => {
        const ctx = getContextFromConfig(config);
        return def.execute(input as never, ctx);
      },
      {
        name: def.name,
        description: def.description,
        schema: def.schema,
      },
    ),
  );
}
