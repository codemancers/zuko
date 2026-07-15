import { z } from 'zod';

/**
 * Allow-list of providerIds we accept. Add new entries when a new
 * vendor needs UI-side credential entry.
 */
export const SUPPORTED_ACCOUNT_PROVIDERS = ['claude', 'jira'] as const;

/**
 * Shape of the blob `claude login` writes to
 * ~/.claude/.credentials.json under the `claudeAiOauth` key. We persist
 * the OAuth fields directly on the account row; vendor-specific extras
 * (subscriptionType, rateLimitTier) are ignored.
 */
export const claudeAiOauthSchema = z.object({
  accessToken: z.string().min(8).max(4000),
  refreshToken: z.string().min(8).max(4000),
  expiresAt: z.number().int().positive(),
  scopes: z.array(z.string()).default([]),
});

export type ClaudeAiOauth = z.infer<typeof claudeAiOauthSchema>;

/**
 * Body for `POST /accounts/oauth`. Discriminated on providerId so we
 * can plug new vendors (OpenAI, etc.) in without rewriting callers.
 */
export const upsertAccountOauthSchema = z.discriminatedUnion('providerId', [
  z.object({
    providerId: z.literal('claude'),
    credentials: claudeAiOauthSchema,
  }),
]);

export type UpsertAccountOauthDto = z.infer<typeof upsertAccountOauthSchema>;
