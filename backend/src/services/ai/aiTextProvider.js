import { textProvider } from './aiProviderFactory.js';

export async function generateAssistantReply(userPrompt, systemPrompt = 'Answer concisely from the supplied evidence. Do not invent facts.') {
  const response = await textProvider.generateText({ systemPrompt, userPrompt, temperature: 0.2, maxTokens: 2048 });
  return response.text;
}
