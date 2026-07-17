import { z } from 'zod';

const envSchema = z.object({
  // Fly Sprites auth — sandbox provisioning (agent/sandbox/fly-sprite.ts)
  SPRITES_TOKEN: z.string().min(1),
  // HMAC signing for x-eve-principal — must match backend BETTER_AUTH_SECRET
  BETTER_AUTH_SECRET: z.string().min(1),
  // Claude Code OAuth token — used when user hasn't linked Claude in Settings
  CLAUDE_CODE_OAUTH_TOKEN: z.string().min(1),
  ZUKO_BACKEND_URL: z.string().url().default('http://localhost:3001'),
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
