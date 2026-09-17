import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { createTextProvider } from '../src/services/ai/providerClient.js';
import { computeBestMatches } from '../src/services/scoringService.js';

const schema = z.object({ skills: z.array(z.string()) });
const options = { systemPrompt: 'Return JSON', userPrompt: 'React', schema, schemaName: 'skills' };
function fixture() {
  const client = { post: vi.fn() };
  return { client, provider: createTextProvider({ provider: 'groq', apiKey: 'test', model: 'openai/gpt-oss-120b', client, sleep: async () => {} }) };
}
const response = (text) => ({ data: { choices: [{ message: { content: text } }] } });
describe('AI provider boundaries', () => {
  it('requires the key and model', () => {
    expect(() => createTextProvider({ provider: 'groq', apiKey: '', model: 'x' })).toThrow('GROQ_API_KEY');
    expect(() => createTextProvider({ provider: 'groq', apiKey: 'x', model: '' })).toThrow('GROQ_MODEL');
  });
  it('uses system/user separation and strict schema on supported models', async () => {
    const {client, provider} = fixture(); client.post.mockResolvedValue(response('{"skills":["React"]}'));
    expect((await provider.generateStructuredJson(options)).data.skills).toEqual(['React']);
    expect(client.post.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(client.post.mock.calls[0][1].response_format.json_schema.strict).toBe(true);
    expect(client.post.mock.calls[0][1].messages.map((m)=>m.role)).toEqual(['system','user']);
  });
  it.each(['invalid-json', '{"skills":1}'])('rejects malformed structured output: %s', async (text) => {
    const { client, provider } = fixture(); client.post.mockResolvedValue(response(text));
    await expect(provider.generateStructuredJson(options)).rejects.toMatchObject({ code: 'extraction_invalid' });
    expect(client.post).toHaveBeenCalledTimes(2);
  });
  it('recovers a transient failure and limits retries', async () => {
    const {client, provider} = fixture(); client.post.mockRejectedValueOnce({ response: { status: 429 } }).mockResolvedValue(response('Ready'));
    expect((await provider.generateText({ systemPrompt: 'x', userPrompt: 'x' })).text).toBe('Ready');
  });
  it.each([[401,'ai_authentication_failed'],[404,'ai_model_unavailable'],[429,'ai_rate_limited']])('maps status %s safely', async (status, code) => {
    const {client, provider} = fixture();client.post.mockRejectedValue({response:{status,data:{error:{message:'private upstream content'}}}});
    await expect(provider.generateText({ systemPrompt:'x',userPrompt:'x' })).rejects.toMatchObject({ code });
  });
  it('identical vectors cannot match unrelated technologies', () => {
    const result = computeBestMatches([{skill_name:'PyTorch',weight:1,category:'ml_framework',embedding_vector:[1,0]}],[{name:'React',category:'frontend_framework',vector:[1,0]}]);
    expect(result[0].m).toBe(0);
  });
  it('keyword-only evidence does not receive full readiness credit', () => {
    expect(computeBestMatches([{skill_name:'React',weight:1,embedding_vector:[1,0]}],[{name:'React',vector:[1,0],evidence:[]}])[0].m).toBe(0.4);
  });
});
