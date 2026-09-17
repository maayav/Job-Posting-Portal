import { env } from '../../config/env.js';
import { createTextProvider } from './providerClient.js';

function provider(name) {
  return createTextProvider(name === 'groq'
    ? { provider: 'groq', apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, fallbackModels: env.GROQ_FALLBACK_MODELS.split(',').map((m) => m.trim()).filter(Boolean) }
    : { provider: 'gemini', apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL });
}
async function call(method, options) {
  try { return await provider(env.AI_TEXT_PROVIDER)[method](options); }
  catch (error) {
    if (env.AI_TEXT_FALLBACK_PROVIDER === 'none' || env.AI_TEXT_FALLBACK_PROVIDER === env.AI_TEXT_PROVIDER || error.statusCode !== 503) throw error;
    console.warn(JSON.stringify({ event: 'ai_provider_fallback', from: env.AI_TEXT_PROVIDER, to: env.AI_TEXT_FALLBACK_PROVIDER }));
    return provider(env.AI_TEXT_FALLBACK_PROVIDER)[method](options);
  }
}
export const textProvider = {
  generateText: (options) => call('generateText', options),
  generateStructuredJson: (options) => call('generateStructuredJson', options),
};
