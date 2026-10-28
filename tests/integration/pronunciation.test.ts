import 'dotenv/config';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { randomUUID,randomBytes,createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { db } from '@mvs/database';
import { makeAuth } from '../../apps/api/src/auth.js';
import { storage } from '../../packages/storage/src/index.js';
import { utteranceSchema } from '@mvs/contracts';

describe.skipIf(process.env.MVS_RUN_INTEGRATION!=='true')('Russian pronunciation with real API and saved references',()=>{
 const origin=process.env.BETTER_AUTH_URL||'http://localhost:3000';let owner='',other='',cookie='',foreignCookie='',projectId='',chapterId='',pageId='',utteranceId='';
 async function request(path:string,method='GET',body?:unknown,session=cookie){const response=await fetch(origin+'/api/v1'+path,{method,headers:{Cookie:session,Origin:origin,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json() as any};}
 async function ok(path:string,method='GET',body?:unknown){const r=await request(path,method,body);expect(r.status,JSON.stringify(r.data)).toBeLessThan(300);return r.data;}
 async function finished(id:string){let job:any;await expect.poll(async()=>{job=await ok('/jobs/'+id);return job.status;},{timeout:120000,interval:1000}).toMatch(/succeeded|failed|blocked|cancelled/);expect(job.status,job.error).toBe('succeeded');return job;}
 async function edit(text:string){const p=await ok('/pages/'+pageId);return ok('/pages/'+pageId,'PUT',{expectedRevision:p.revision,panels:[],utterances:p.utterances.map((u:any)=>({...utteranceSchema.parse(u),spokenText:text}))});}
 beforeAll(async()=>{
  async function account(){const email=randomUUID()+'@mvs-test.invalid',password=randomBytes(24).toString('base64url');const a=await makeAuth(true).api.signUpEmail({body:{name:'Pronunciation fixture',email,password}});const response=await fetch(origin+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password})});expect(response.status).toBe(200);return {id:a.user.id,cookie:response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};}
  const a=await account(),b=await account();owner=a.id;cookie=a.cookie;other=b.id;foreignCookie=b.cookie;
  projectId=(await db.project.create({data:{ownerId:owner,title:'Pronunciation regression'}})).id;
  chapterId=(await db.chapter.create({data:{projectId,title:'Numbers',order:0}})).id;
  pageId=(await db.page.create({data:{projectId,chapterId,order:0,name:'Owned fixture',width:800,height:1000,imageKey:projectId+'/test.png',previewKey:projectId+'/test.png',sourceKey:projectId+'/test.png',checksum:'fixture',transform:{}}})).id;
  const reference=await fs.readFile('outputs/voice-description/default-settings/prepared-2026.wav'),referenceKey=projectId+'/reference.wav';await storage.write(referenceKey,reference);
  const profile=await db.voiceProfile.create({data:{projectId,name:'Saved synthetic fixture'}});
  const voice=await db.voiceProfileVersion.create({data:{projectId,profileId:profile.id,referenceKey,transcript:'Сегодня начинается новая история. Я готов идти вперёд, даже если путь окажется непростым.',language:'Russian',checksum:createHash('sha256').update(reference).digest('hex'),modelRevision:'user-reference-v1',settings:{rightsConfirmed:true}}});
  utteranceId=randomUUID();await db.utterance.create({data:{id:utteranceId,projectId,pageId,bbox:{x:.1,y:.1,width:.4,height:.2},order:0,kind:'narration',originalText:'2016 год.',spokenText:'2016 год.',voiceVersionId:voice.id,reviewStatus:'reviewed',included:true}});
 },30000);
 afterAll(async()=>{if(projectId){await db.utterance.deleteMany({where:{projectId}});await db.page.deleteMany({where:{projectId}});await db.project.delete({where:{id:projectId}});await storage.removeProject(projectId);}for(const id of [owner,other].filter(Boolean))await db.user.delete({where:{id}});await db.$disconnect();},30000);
 it('previews saved revisions, enforces ownership and preserves manual text and OCR',async()=>{
  const preview=await ok('/utterances/'+utteranceId+'/pronunciation');expect(preview).toMatchObject({utteranceId,utteranceRevision:0,spokenText:'2016 год.',synthesisText:'Две тысячи шестнадцатый год.',textPreparationVersion:'ru-numbers-v1',warnings:[]});
  expect((await request('/utterances/'+utteranceId+'/pronunciation','GET',undefined,foreignCookie)).status).toBe(404);
  const saved=await edit('Если упо́рно тренироваться, можно стать в 7 раз сильнее.');expect(saved.utterances[0].originalText).toBe('2016 год.');
  const marked=await ok('/utterances/'+utteranceId+'/pronunciation');expect(marked.utteranceRevision).toBe(saved.utterances[0].revision);expect(marked.synthesisText).toBe('Если упо́рно тренироваться, можно стать в семь раз сильнее.');
  expect((await request('/pages/'+pageId,'PUT',{expectedRevision:0,panels:[],utterances:[]})).status).toBe(409);
  await edit('Код 2016. В 12:30.');expect((await ok('/utterances/'+utteranceId+'/pronunciation')).warnings.length).toBeGreaterThan(0);
  await edit('2016 год.');
 });
 it.skipIf(process.env.MVS_INTEGRATION_GPU!=='true')('keeps old v2 immutable, uses exact prepared snapshots, caches new audio and invalidates renders',async()=>{
  const j=await ok('/utterances/'+utteranceId+'/speech','POST',{}),newJob=await finished(j.jobId);
  const preview=await ok('/utterances/'+utteranceId+'/pronunciation');expect(newJob.input.canonical.synthesisText).toBe(preview.synthesisText);expect(newJob.result).toMatchObject({textPreparationVersion:'ru-numbers-v1',synthesisText:preview.synthesisText,cloningMode:'reference-only',sampleRate:24000,sourceSampleRate:48000});
  const cached=await finished((await ok('/utterances/'+utteranceId+'/speech','POST',{})).jobId);expect(cached.result.cached).toBe(true);expect(cached.result.artifactId).toBe(newJob.result.artifactId);
  const legacyInput=JSON.parse(JSON.stringify(newJob.input));legacyInput.canonical.textPreparationVersion='ru-caps-v1';legacyInput.canonical.synthesisText='2016 год.';
  const legacy=await db.$transaction(async tx=>{const job=await tx.job.create({data:{projectId,ownerId:owner,kind:'speech',input:legacyInput,idempotencyKey:randomUUID()}});await tx.outboxEvent.create({data:{jobId:job.id}});return job;});
  const historical=await finished(legacy.id);expect(historical.input).toEqual(legacyInput);expect(historical.result).toMatchObject({cloningMode:'reference-only',synthesisText:'2016 год.',textPreparationVersion:'ru-caps-v1'});expect((await ok('/pages/'+pageId)).utterances[0].activeAudioId).toBe(newJob.result.artifactId);
  const current=(await ok('/pages/'+pageId)).utterances[0];expect((await request('/utterances/'+utteranceId+'/audio','POST',{artifactId:historical.result.artifactId,expectedRevision:current.revision})).status).toBe(422);
  const render=await finished((await ok('/chapters/'+chapterId+'/render','POST',{})).jobId);expect(render.result.manifest.segments).toHaveLength(1);
  await edit('В 2016 году.');expect((await ok('/utterances/'+utteranceId+'/pronunciation')).synthesisText).toBe('В две тысячи шестнадцатом году.');
  expect((await request('/files/'+render.result.fileKey)).status).toBe(409);
  const changed=await finished((await ok('/utterances/'+utteranceId+'/speech','POST',{})).jobId);expect(changed.result.artifactId).not.toBe(newJob.result.artifactId);expect(changed.result.synthesisText).toBe('В две тысячи шестнадцатом году.');
 },180000);
});
