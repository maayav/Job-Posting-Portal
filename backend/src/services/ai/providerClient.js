import axios from 'axios';
import { z } from 'zod';
import { AppError } from '../../utils/errors.js';

const strictModels = new Set(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function strictSchema(schema) {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  delete json.$schema;
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    delete node.default;
    if (node.properties) { node.additionalProperties = false; node.required = Object.keys(node.properties); }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(json);
  return json;
}

function providerError(error) {
  if (error instanceof AppError) return error;
  const status = error.response?.status;
  const code = error.response?.data?.error?.code;
  if (status === 401 || status === 403) return new AppError('AI service credentials need attention. Contact the administrator.', 503, 'ai_authentication_failed');
  if (status === 404 || code === 'model_not_found') return new AppError('The configured AI model is unavailable. Contact the administrator.', 503, 'ai_model_unavailable');
  if (status === 429) return new AppError('AI service is busy. Please retry shortly.', 503, 'ai_rate_limited');
  if (status === 413) return new AppError('This analysis exceeds the AI service request limit. Try a shorter question.', 422, 'ai_request_too_large');
  if (error.code === 'ECONNABORTED') return new AppError('AI request timed out. Please retry.', 503, 'ai_timeout');
  return new AppError('AI service is temporarily unavailable. Please retry.', 503, 'service_unavailable');
}

export function createTextProvider({ provider, apiKey, model, fallbackModels = [], client = axios, sleep = wait }) {
  if (!apiKey?.trim()) throw new AppError(`${provider.toUpperCase()}_API_KEY is required`, 503, 'ai_configuration_error');
  if (!model?.trim()) throw new AppError(`${provider.toUpperCase()}_MODEL is required`, 503, 'ai_configuration_error');
  async function request(options) {
    let lastError;
    for (const chosenModel of [...new Set([model, ...fallbackModels])]) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { systemPrompt, userPrompt, temperature = 0.2, maxTokens = 4096, schema, schemaName = 'response' } = options;
          let text;
          if (provider === 'groq') {
            const response_format = schema ? (strictModels.has(chosenModel) ? { type: 'json_schema', json_schema: { name: schemaName, strict: true, schema: strictSchema(schema) } } : { type: 'json_object' }) : undefined;
            const response = await client.post('https://api.groq.com/openai/v1/chat/completions', {
              model: chosenModel,
              messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
              temperature, max_completion_tokens: maxTokens, response_format,
              ...(chosenModel.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
            }, { timeout: 45000, headers: { Authorization: `Bearer ${apiKey}` } });
            text = response.data?.choices?.[0]?.message?.content;
          } else {
            const response = await client.post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(chosenModel)}:generateContent`, {
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: { temperature, maxOutputTokens: maxTokens, ...(schema ? { responseMimeType: 'application/json' } : {}) },
            }, { timeout: 45000, headers: { 'x-goog-api-key': apiKey } });
            text = response.data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
          }
          if (!text?.trim()) throw new AppError('AI returned an incomplete response. Please retry.', 422, 'extraction_invalid');
          if (!schema) return { text: text.trim(), model: chosenModel, provider };
          let data;
          try { data = schema.parse(JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))); }
          catch { throw new AppError('AI returned invalid structured data. Please retry.', 422, 'extraction_invalid'); }
          return { data, model: chosenModel, provider };
        } catch (error) {
          lastError = error;
          const status = error.response?.status;
          const transient = !error.response && !(error instanceof AppError) || [429,500,502,503,504].includes(status);
          const invalid = error.code === 'extraction_invalid' || error.response?.data?.error?.code === 'json_validate_failed';
          // Never log Axios errors or upstream bodies: they can contain credentials or candidate data.
          console.warn(JSON.stringify({ event: 'ai_provider_failure', provider, model: chosenModel, status, code: error instanceof AppError ? error.code : error.code || 'upstream_error', attempt: attempt + 1 }));
          if (attempt === 0 && (transient || invalid)) {
            await sleep(Math.min(5000, Math.max(250, (Number(error.response?.headers?.['retry-after']) || 1) * 1000)));
            continue;
          }
          if (!transient && !invalid && status !== 404) throw providerError(error);
          break;
        }
      }
    }
    throw providerError(lastError);
  }
  return {
    generateText: (options) => request(options),
    generateStructuredJson: (options) => request(options),
  };
}
