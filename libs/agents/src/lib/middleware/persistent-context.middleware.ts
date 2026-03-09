import { createMiddleware } from 'langchain';
import { z } from 'zod';
import type { ContextEntityReference } from '../types/chat.types';

/**
 * Reducer for contextEntities - replaces current value with update
 * Uses last-write-wins semantics
 */
const contextEntitiesReducer = (
  current: ContextEntityReference[] | undefined,
  update: ContextEntityReference[] | undefined,
): ContextEntityReference[] => {
  return update ?? current ?? [];
};

/**
 * Reducer for userId - replaces current value with update
 * Uses last-write-wins semantics
 */
const userIdReducer = (
  current: number | undefined,
  update: number | undefined,
): number | undefined => {
  return update ?? current;
};

/**
 * Reducer for organizationId - replaces current value with update
 */
const organizationIdReducer = (
  current: number | undefined,
  update: number | undefined,
): number | undefined => {
  return update ?? current;
};

/**
 * State schema for persistent context fields
 * These fields are persisted in LangGraph checkpoints and restored on page reload
 */
const PersistentContextStateSchema = z.object({
  contextEntities: z
    .array(
      z.object({
        type: z.enum(['contact', 'company', 'deal']),
        id: z.number(),
      }),
    )
    .default([])
    .meta({
      reducer: {
        fn: contextEntitiesReducer,
        schema: z
          .array(
            z.object({
              type: z.enum(['contact', 'company', 'deal']),
              id: z.number(),
            }),
          )
          .optional(),
      },
    }),
  userId: z
    .number()
    .optional()
    .meta({
      reducer: {
        fn: userIdReducer,
        schema: z.number().optional(),
      },
    }),
  organizationId: z
    .number()
    .optional()
    .meta({
      reducer: {
        fn: organizationIdReducer,
        schema: z.number().optional(),
      },
    }),
});

/**
 * Create middleware for persistent context fields (contextEntities, userId)
 *
 * This middleware adds contextEntities and userId to the agent's state schema,
 * making them persist across conversation turns via LangGraph's checkpointer.
 *
 * Unlike contextSchema (which is runtime-only), fields in the state schema are
 * automatically persisted to checkpoints and restored on page reload.
 *
 * @returns AgentMiddleware that adds persistent context state fields
 */
export function createPersistentContextMiddleware() {
  return createMiddleware({
    name: 'PersistentContextMiddleware',
    stateSchema: PersistentContextStateSchema,
  });
}
