import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  AI_TEXT_PROVIDER: z.enum(['groq', 'gemini']).default('groq'),
  AI_EMBEDDING_PROVIDER: z.literal('gemini').default('gemini'),
  AI_TEXT_FALLBACK_PROVIDER: z.enum(['none', 'groq', 'gemini']).default('none'),
  // Groq powers text generation (skill extraction and the assistant).
  GROQ_API_KEY: z.string().default(''),
  GROQ_MODEL: z.string().default(''),
  GROQ_FALLBACK_MODELS: z.string().default('openai/gpt-oss-20b,qwen/qwen3.8-27b'),
  // Gemini is retained for the existing embedding pipeline because Groq does
  // not expose an embeddings endpoint.
  GEMINI_API_KEY: z.string().default(''),
  GEMINI_MODEL: z.string().default('gemini-3.5-flash'),
  GEMINI_EMBEDDING_MODEL: z.string().optional(),
  EMBEDDING_MODEL: z.string().default('gemini-embedding-2'),
  EMBEDDING_VERSION: z.string().default('2026-09'),
  GITHUB_TOKEN: z.string().optional().default(''),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'test' && !env.GEMINI_API_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['GEMINI_API_KEY'], message: 'GEMINI_API_KEY is required for embeddings' });
  }
  if (env.NODE_ENV !== 'test' && (env.AI_TEXT_PROVIDER === 'groq' || env.AI_TEXT_FALLBACK_PROVIDER === 'groq') && (!env.GROQ_API_KEY || !env.GROQ_MODEL)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['GROQ_API_KEY'],
      message: 'GROQ_API_KEY and GROQ_MODEL are required for Groq',
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = { ...parsed.data, EMBEDDING_MODEL: parsed.data.GEMINI_EMBEDDING_MODEL || parsed.data.EMBEDDING_MODEL };
