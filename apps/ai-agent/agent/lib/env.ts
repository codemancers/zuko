import { z } from 'zod';

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  ZUKO_BACKEND_URL: z.string().url().default('http://localhost:3001'),
  // Required for local TUI dev (localDev() bypasses session auth, no cookie available).
  ZUKO_ORG_ID: z.coerce.number().int().positive().optional(),
  // Session cookie for TUI dev — copy `better-auth.session_token` from browser DevTools.
  ZUKO_SESSION_TOKEN: z.string().optional(),
});

let cached: z.infer<typeof envSchema> | undefined;

export function env(): z.infer<typeof envSchema> {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `ai-agent env invalid: ${parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
      );
    }
    cached = parsed.data;
  }
  return cached;
}
