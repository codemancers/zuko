import { createMiddleware } from 'langchain';
import { z } from 'zod';
import type { ContextEntityReference } from '../../types/chat';

const contextEntitiesReducer = (
  current: ContextEntityReference[] | undefined,
  update: ContextEntityReference[] | undefined,
): ContextEntityReference[] => update ?? current ?? [];

const userIdReducer = (
  current: number | undefined,
  update: number | undefined,
): number | undefined => update ?? current;

const organizationIdReducer = (
  current: number | undefined,
  update: number | undefined,
): number | undefined => update ?? current;

const PersistentContextStateSchema = z.object({
  contextEntities: z
    .array(z.object({ type: z.enum(['contact', 'company', 'deal']), id: z.number() }))
    .default([])
    .meta({
      reducer: {
        fn: contextEntitiesReducer,
        schema: z.array(z.object({ type: z.enum(['contact', 'company', 'deal']), id: z.number() })).optional(),
      },
    }),
  userId: z.number().optional().meta({
    reducer: { fn: userIdReducer, schema: z.number().optional() },
  }),
  organizationId: z.number().optional().meta({
    reducer: { fn: organizationIdReducer, schema: z.number().optional() },
  }),
});

export function createPersistentContextMiddleware(): ReturnType<typeof createMiddleware> {
  return createMiddleware({
    name: 'PersistentContextMiddleware',
    stateSchema: PersistentContextStateSchema,
  });
}
