import { z } from 'zod';

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  // Fly Sprites auth — sandbox provisioning (agent/sandbox/fly-sprite.ts)
  SPRITES_TOKEN: z.string().min(1),
  ZUKO_BACKEND_URL: z.string().url().default('http://localhost:3001'),
  // TUI dev: copy better-auth.session_token from browser DevTools → Application → Cookies
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
