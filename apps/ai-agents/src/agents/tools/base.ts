import type { ZodTypeAny, infer as ZInfer } from 'zod';
import type { ToolContext } from './context';

export interface ToolDef<I extends ZodTypeAny, O> {
  name: string;
  description: string;
  schema: I;
  execute: (input: ZInfer<I>, ctx: ToolContext) => Promise<O>;
  needsApproval?: (input: ZInfer<I>) => boolean | Promise<boolean>;
}

export function defineTool<I extends ZodTypeAny, O>(
  def: ToolDef<I, O>,
): ToolDef<I, O> {
  return def;
}
