import Joi from 'joi';

export const agentsEnvSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().min(1).optional(),
  OPENAI_API_KEY: Joi.string().optional(),
  AGENTS_LLM_MODEL: Joi.string().optional(),
  AGENTS_SYSTEM_PROMPT: Joi.string().optional(),
  AGENTS_API_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .optional(),
  AGENTS_API_KEY: Joi.string().min(1).optional(),
  // Auth environment variables
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),
  TRUSTED_ORIGINS: Joi.string().optional(),
  // Nango — credentials live in Nango dashboard, not here
  NANGO_SECRET_KEY: Joi.string().optional(),
  NANGO_HOST: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .optional(),
}).unknown(true);
