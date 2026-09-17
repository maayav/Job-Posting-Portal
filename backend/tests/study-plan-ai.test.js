import { describe, it, expect, vi } from 'vitest';
import { enrichStudyPlan } from '../src/services/ai/studyPlanService.js';
import { textProvider } from '../src/services/ai/aiProviderFactory.js';
vi.mock('../src/services/ai/aiProviderFactory.js',()=>({textProvider:{generateStructuredJson:vi.fn()}}));
describe('Study plan grounding',()=>{
  it('keeps gaps without resources and rejects invented skills and URLs',async()=>{
    textProvider.generateStructuredJson.mockResolvedValue({data:{studyPlan:[
      {skill:'System Design',reason:'Role requirement',resourceUrls:['https://react.dev/learn'],learningObjectives:['Design a cache']},
      {skill:'Invented',reason:'wrong',resourceUrls:[]},
    ]}});
    const result=await enrichStudyPlan([{skill:'System Design',priority:1,resources:[],done:false}],'SDE',['React']);
    expect(result).toHaveLength(1); expect(result[0].resources).toEqual([]);expect(result[0].skill).toBe('System Design');expect(result[0].priority).toBe(1);
  });
});
