import { it,expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { progressSchema,summarizeBatch,jobPhases } from '@mvs/contracts';
it('requires honest, bounded counters and orders preparation before voice generation',()=>{
 const base={phase:'generating',updatedAt:new Date().toISOString()};
 expect(progressSchema.safeParse({...base,completed:4,total:3}).success).toBe(false);
 expect(progressSchema.safeParse({...base,completed:1}).success).toBe(false);
 expect(progressSchema.safeParse(base).success).toBe(true);
 const steps=jobPhases('voice_design');expect(steps.indexOf('preparing_prompt')).toBeLessThan(steps.indexOf('generating'));expect(steps.at(-1)).toBe('complete');
});
it('counts the latest attempt per utterance across the complete batch',()=>{
 const jobs=Array.from({length:110},(_,i)=>({input:{utteranceId:String(i),batchRemaining:12},createdAt:new Date(0),status:'succeeded'}));
 jobs[0].status='failed';jobs.push({input:{utteranceId:'0',batchRemaining:12},createdAt:new Date(1),status:'queued'});
 expect(summarizeBatch(randomUUID(),jobs)).toMatchObject({total:110,succeeded:109,failed:0,active:1,remaining:12});
});
