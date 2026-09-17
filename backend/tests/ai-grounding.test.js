import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { textProvider } from '../src/services/ai/aiProviderFactory.js';
import { extractSkills } from '../src/services/skillExtractionService.js';
import { generateEmbeddings } from '../src/services/ai/embeddingProvider.js';
import { fetchLeetcodeProfile } from '../src/services/leetcodeService.js';
vi.mock('axios', () => ({ default: { post: vi.fn() } }));
vi.mock('../src/services/ai/aiProviderFactory.js', () => ({ textProvider: { generateStructuredJson: vi.fn() } }));
describe('AI source and embedding boundaries', () => {
  it('preserves real quotes and removes invented skills and evidence', async () => {
    textProvider.generateStructuredJson.mockResolvedValue({model:'groq-test',data:{skills:[
      {name:'React',category:'frontend_framework',sources:['resume'],evidence:[{source:'resume',text:'Built React app'},{source:'resume',text:'Deployed to millions'}],proficiency_signals:{projects_count:1,mentions_depth:'medium',has_production_usage:true}},
      {name:'PyTorch',category:'ml_framework',sources:['resume'],evidence:[],proficiency_signals:{projects_count:0,mentions_depth:'low',has_production_usage:false}},
    ]}});
    const result=await extractSkills('=== RESUME ===\nBuilt React app');
    expect(result.skills.map((s)=>s.name)).toEqual(['React']);
    expect(result.skills[0].evidence).toEqual([{source:'resume',text:'Built React app'}]);
    expect(result.skills[0].proficiency_signals.has_production_usage).toBe(false);
    expect(result.skills[0].category).toBe('frontend_framework');
  });
  it('keeps the Gemini embedding endpoint and vector dimensions', async()=>{
    axios.post.mockResolvedValueOnce({data:{embeddings:[{values:[3,4,0]}]}});
    const vectors=await generateEmbeddings(['React']);
    expect(axios.post.mock.lastCall[0]).toContain('generativelanguage.googleapis.com');
    expect(axios.post.mock.lastCall[0]).toContain('gemini-embedding-2');
    expect(vectors[0]).toEqual([0.6,0.8,0]);
  });
  it('does not fabricate LeetCode evidence on unavailable profiles', async()=>{
    axios.post.mockRejectedValueOnce(new Error('unavailable'));
    expect(await fetchLeetcodeProfile('demo')).toEqual({status:'unavailable',evidence:''});
  });
});
