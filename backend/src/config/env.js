import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  // MONGO_URI is the project name; MONGODB_URI is accepted for Render/Atlas setups.
  MONGO_URI: z.string().default(''),
  MONGODB_URI: z.string().default(''),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Comma-separated list of allowed browser origins (e.g. the Vercel URL).
  CLIENT_URL: z.string().default(''),
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
  if (!env.MONGO_URI && !env.MONGODB_URI) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['MONGO_URI'],
      message: 'MONGO_URI (or MONGODB_URI) is required',
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

const resolvedMongoUri = parsed.data.MONGO_URI || parsed.data.MONGODB_URI;

// Missing AI credentials are not fatal at startup: the server still serves
// health, auth, jobs and applications, while AI endpoints return a clear
// configuration error (503 ai_configuration_error) at request time.
if (parsed.data.NODE_ENV !== 'test') {
  const warnings = [];
  if (!parsed.data.GEMINI_API_KEY) warnings.push('GEMINI_API_KEY is missing — embeddings, analysis seeding and analysis runs will fail until it is set.');
  if ((parsed.data.AI_TEXT_PROVIDER === 'groq' || parsed.data.AI_TEXT_FALLBACK_PROVIDER === 'groq') && (!parsed.data.GROQ_API_KEY || !parsed.data.GROQ_MODEL)) {
    warnings.push('GROQ_API_KEY/GROQ_MODEL are missing — skill extraction, study plans and the AI assistant will fail until they are set.');
  }
  for (const warning of warnings) console.warn(`[config] ${warning}`);
}

export const env = {
  ...parsed.data,
  MONGO_URI: resolvedMongoUri,
  EMBEDDING_MODEL: parsed.data.GEMINI_EMBEDDING_MODEL || parsed.data.EMBEDDING_MODEL,
};
