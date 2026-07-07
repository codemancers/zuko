import { z } from 'zod';

const envSchema = z.object({
  /** Must exactly match the backend's BACKEND_URL — it is the JWT audience. */
  ZUKO_BACKEND_URL: z.string().url().default('http://localhost:3001'),
  // Optional when using Better Auth session auth (org resolved from session).
  ZUKO_ORG_ID: z.coerce.number().int().positive().optional(),
  ZUKO_AGENT_NAME: z.string().min(1).default('zuko-eve-agent'),
  /** Where self-registered credentials are persisted (mount a volume here in Docker). */
  ZUKO_AGENT_STATE_DIR: z.string().min(1).default('./.zuko'),
  /** Pre-provisioned agent credentials — set both to skip self-registration. */
  ZUKO_AGENT_ID: z.string().optional(),
  ZUKO_AGENT_PRIVATE_JWK: z.string().optional(),
  ZUKO_AGENT_PUBLIC_JWK: z.string().optional(),
  /**
   * Host identity provisioned by the backend's `bun run provision:agent-host`.
   * Required for self-registration: the backend's agent-auth tables use
   * numeric ids, so the plugin's dynamic (thumbprint-issuer) host
   * registration is not supported there.
   */
  ZUKO_HOST_ID: z.coerce.number().int().positive().optional(),
  ZUKO_HOST_PRIVATE_JWK: z.string().optional(),
  ZUKO_HOST_PUBLIC_JWK: z.string().optional(),
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
