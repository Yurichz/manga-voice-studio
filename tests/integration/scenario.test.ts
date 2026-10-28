import 'dotenv/config';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { randomUUID,randomBytes,createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import sharp from 'sharp';
import { db } from '@mvs/database';
import { makeAuth } from '../../apps/api/src/auth.js';
import { storage } from '../../packages/storage/src/index.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeJobProgress } from '../../apps/worker/src/progress.js';
import { speechInput,speechModel } from '@mvs/contracts';
import { prepareSpeechTexts } from '../../packages/contracts/src/server.js';
const enabled=process.env.MVS_RUN_INTEGRATION==='true';
async function runtimeProcesses(){
 if(process.platform!=='win32')return [];
 const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-Command',`$runtime=Join-Path (Get-Location).Path 'services\\ai\\runtime.py'; @(Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($runtime) } | ForEach-Object { [pscustomobject]@{id=$_.ProcessId;started=$_.CreationDate.ToUniversalTime().ToString('o')} }) | ConvertTo-Json -Compress`]);
 const data=stdout.trim()?JSON.parse(stdout):[];return (Array.isArray(data)?data:[data]) as {id:number;started:string}[];
}
describe.skipIf(!enabled)('real PostgreSQL/Redis/API integration — explicitly enabled',()=>{
 let user1:string,user2:string,cookie1:string,cookie2:string,p1:any,p2:any,c1:any,page:any,character:any;const projectIds:string[]=[];
 const origin=process.env.BETTER_AUTH_URL||'http://localhost:3000';
 async function request(cookie:string,path:string,method='GET',body?:unknown){const r=await fetch(origin+'/api/v1'+path,{method,headers:{Cookie:cookie,Origin:origin,...(body instanceof FormData?{}:{'Content-Type':'application/json'}),'Idempotency-Key':randomUUID()},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});let data:any;try{data=await r.json();}catch{data=null;}return {status:r.status,data};}
 async function ok(path:string,method='GET',body?:unknown){const r=await request(cookie1,path,method,body);if(r.status>=400)throw new Error(`${method} ${path}: ${r.status} ${r.data?.error?.message}`);return r.data;}
 async function finished(jobId:string,expected='succeeded',timeoutSeconds=90){for(let i=0;i<timeoutSeconds;i++){const j=await ok('/jobs/'+jobId);if(['failed','blocked','cancelled','succeeded'].includes(j.status)){expect(j.status,j.error||'job result').toBe(expected);return j;}await new Promise(resolve=>setTimeout(resolve,1000));}throw new Error('Job did not finish in '+timeoutSeconds+' seconds');}
 beforeAll(async()=>{
  await db.$queryRaw`SELECT 1`;
  async function account(){const email=randomUUID()+'@mvs-test.invalid',password=randomBytes(24).toString('base64url');const created=await makeAuth(true).api.signUpEmail({body:{name:'Integration fixture',email,password}});const r=await fetch(origin+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password})});expect(r.status).toBe(200);return {id:created.user.id,cookie:r.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};}
  const a=await account(),b=await account();user1=a.id;user2=b.id;cookie1=a.cookie;cookie2=b.cookie;
  p1=await ok('/projects','POST',{title:'Integration 1',textLanguage:'ru',speechLanguage:'Russian',ownerId:user2});projectIds.push(p1.id);expect(p1.ownerId).toBe(user1);
  const r=await request(cookie2,'/projects','POST',{title:'Integration 2',textLanguage:'ru',speechLanguage:'Russian'});expect(r.status).toBe(201);p2=r.data;projectIds.push(p2.id);
  c1=await ok('/projects/'+p1.id+'/chapters','POST',{title:'Chapter 1'});
  const form=new FormData();const png=await fs.readFile('work/fixtures/chapter-1.png');form.append('files',new Blob([new Uint8Array(png)]),'1.png');const j=await ok('/chapters/'+c1.id+'/import','POST',form);await finished(j.jobId);page=(await ok('/chapters/'+c1.id)).pages[0];page=await ok('/pages/'+page.id);character=await ok('/projects/'+p1.id+'/characters','POST',{name:'Fixture hero'});
 },90000);
 afterAll(async()=>{for(const projectId of projectIds){await db.project.updateMany({where:{id:projectId},data:{deletedAt:new Date()}});await db.utterance.deleteMany({where:{projectId}});await db.character.deleteMany({where:{projectId}});await db.chapter.deleteMany({where:{projectId}});await db.audioArtifact.deleteMany({where:{projectId}});await db.characterMerge.deleteMany({where:{projectId}});await db.project.deleteMany({where:{id:projectId}});await storage.removeProject(projectId);}if(user1)await db.user.deleteMany({where:{id:user1}});if(user2)await db.user.deleteMany({where:{id:user2}});await db.$disconnect();},30000);
 it('persists Unicode annotations and rejects an old revision',async()=>{
  const u={id:randomUUID(),panelId:null,bbox:{x:.1,y:.1,width:.3,height:.2},order:0,kind:'dialogue',originalText:'Привет!','spokenText':'Привет!',characterId:character.id,voiceVersionId:null,pauseMs:300,included:false,reviewStatus:'reviewed',revision:0};
  const saved=await ok('/pages/'+page.id,'PUT',{expectedRevision:page.revision,panels:[],utterances:[u]});expect(saved.utterances[0].spokenText).toBe('Привет!');const stale=await request(cookie1,'/pages/'+page.id,'PUT',{expectedRevision:page.revision,panels:[],utterances:[]});expect(stale.status).toBe(409);await db.$disconnect();page=await ok('/pages/'+page.id);expect(page.utterances[0].characterId).toBe(character.id);
 });
 it('isolates projects, pages, files and jobs from the second owner',async()=>{
  expect((await request(cookie2,'/projects/'+p1.id)).status).toBe(404);expect((await request(cookie2,'/pages/'+page.id)).status).toBe(404);expect((await request(cookie2,'/pages/'+page.id+'/candidates','POST',{bbox:{x:0,y:0,width:.2,height:.2}})).status).toBe(404);
  const file=await fetch(origin+'/api/v1/files/'+page.imageKey,{headers:{Cookie:cookie2}});expect(file.status).toBe(404);const jobs=await ok('/projects/'+p1.id+'/jobs');expect((await request(cookie2,'/jobs/'+jobs[0].id)).status).toBe(404);
  await storage.write(p1.id+'/renders/unpublished.wav',Buffer.from('unpublished'));expect((await request(cookie1,'/files/'+p1.id+'/renders/unpublished.wav')).status).toBe(404);
 });
 it('keeps every active job, hides attempt tokens and counts complete batches beyond history limit',async()=>{
  const batchId=randomUUID(),ids=Array.from({length:112},()=>randomUUID());
  await db.job.createMany({data:ids.map((id,i)=>({id,batchId,ownerId:user1,projectId:p1.id,kind:'speech',status:i===111?'blocked':'succeeded',stage:i===111?'generating':'complete',attemptToken:'private-attempt-token',progress:i===111?{phase:'generating',completed:1,total:3,unit:'chunks',updatedAt:new Date().toISOString()}:undefined,input:{utteranceId:String(i),batchRemaining:9},idempotencyKey:randomUUID()}))});
  try{
   const response=await ok('/projects/'+p1.id+'/job-progress');expect(response.jobs.some((j:any)=>j.id===ids[111])).toBe(true);expect(response.jobs.filter((j:any)=>j.status==='succeeded').length).toBeLessThanOrEqual(50);
   expect(response.batches.find((b:any)=>b.id===batchId)).toMatchObject({total:112,succeeded:111,active:1,remaining:9});
   expect(JSON.stringify(response)).not.toContain('private-attempt-token');expect(response.jobs[0].input).toBeUndefined();
   expect((await request(cookie2,'/projects/'+p1.id+'/job-progress')).status).toBe(404);
   const retryId=(await ok('/jobs/'+ids[111]+'/retry','POST',{})).jobId;ids.push(retryId);expect((await db.job.findUniqueOrThrow({where:{id:ids[111]}})).status).toBe('cancelled');await db.job.update({where:{id:retryId},data:{status:'blocked'}});
   const after=await ok('/projects/'+p1.id+'/job-progress');expect(after.batches.find((b:any)=>b.id===batchId)).toMatchObject({total:112,active:1});
  }finally{await db.job.deleteMany({where:{id:{in:ids}}});}
 });
 it('enforces the queue quota atomically while allowing idempotent requests',async()=>{
  const ids=Array.from({length:200},()=>randomUUID()),key=randomUUID();
  await db.job.createMany({data:ids.map((id,i)=>({id,ownerId:user1,projectId:p1.id,kind:'voice_design',status:'blocked',input:{},idempotencyKey:i===0?key:randomUUID()}))});
  try{
   const body={name:'Quota verification',description:'A calm voice',transcript:'Проверка лимита.'};
   expect((await request(cookie1,'/projects/'+p1.id+'/voices/design','POST',body)).status).toBe(429);
   const same=await fetch(origin+'/api/v1/projects/'+p1.id+'/voices/design',{method:'POST',headers:{Cookie:cookie1,Origin:origin,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});expect(same.status).toBe(202);expect((await same.json() as any).jobId).toBe(ids[0]);
   expect(await db.job.count({where:{id:{in:ids}}})).toBe(200);
   const retry=await request(cookie1,'/jobs/'+ids[0]+'/retry','POST',{});expect(retry.status).toBe(202);ids.push(retry.data.jobId);expect((await db.job.findUniqueOrThrow({where:{id:ids[0]}})).status).toBe('cancelled');
  }finally{await db.job.deleteMany({where:{id:{in:ids}}});}
 });
 it('rejects progress from an old attempt and after cancellation or publication',async()=>{
  const j=await db.job.create({data:{ownerId:user1,projectId:p1.id,kind:'speech',status:'running',attemptToken:'new',input:{},idempotencyKey:randomUUID()}});
  const value={phase:'generating',completed:1,total:3,unit:'chunks' as const,updatedAt:new Date().toISOString()};
  try{
   expect((await writeJobProgress(j.id,'old',value)).count).toBe(0);expect((await writeJobProgress(j.id,'new',value)).count).toBe(1);
   for(const status of ['cancel_requested','cancelled','succeeded','failed']){await db.job.update({where:{id:j.id},data:{status}});expect((await writeJobProgress(j.id,'new',{...value,completed:2})).count).toBe(0);}
   expect((await db.job.findUniqueOrThrow({where:{id:j.id}})).progress).toMatchObject({completed:1});
  }finally{await db.job.delete({where:{id:j.id}});}
 });
 it('cancels the chapter batch without cancelling another project',async()=>{
  const ids=[randomUUID(),randomUUID(),randomUUID()];await db.job.createMany({data:ids.map((id,i)=>({id,ownerId:i===2?user2:user1,projectId:i===2?p2.id:p1.id,kind:'speech',status:'blocked',input:{pageId:page.id},idempotencyKey:randomUUID()}))});
  try{expect((await ok('/chapters/'+c1.id+'/speech/cancel','POST',{})).cancelRequested).toBe(2);expect((await db.job.findUniqueOrThrow({where:{id:ids[2]}})).status).toBe('blocked');for(const id of ids.slice(0,2))expect((await db.job.findUniqueOrThrow({where:{id}})).status).toMatch(/cancel_requested|cancelled/);}
  finally{await db.job.deleteMany({where:{id:{in:ids}}});}
 });
 it('makes import requests idempotent and rejects foreign voice references',async()=>{
  const key=randomUUID();const png=await sharp({create:{width:30,height:30,channels:3,background:'white'}}).png().toBuffer();const submit=async()=>{const form=new FormData();form.append('files',new Blob([new Uint8Array(png)]),'Тест ё.png');return fetch(origin+'/api/v1/chapters/'+c1.id+'/import',{method:'POST',headers:{Cookie:cookie1,Origin:origin,'Idempotency-Key':key},body:form}).then(r=>r.json()) as Promise<any>;};const a=await submit(),b=await submit();expect(a.jobId).toBe(b.jobId);await finished(a.jobId);expect((await ok('/chapters/'+c1.id)).pages).toHaveLength(2);expect((await ok('/chapters/'+c1.id)).pages[1].name).toBe('Тест ё.png');
  const profile=await db.voiceProfile.create({data:{projectId:p2.id,name:'Foreign'}});const voice=await db.voiceProfileVersion.create({data:{projectId:p2.id,profileId:profile.id,referenceKey:p2.id+'/foreign.wav',transcript:'fixture',language:'Russian',checksum:'fixture',modelRevision:'fixture',settings:{}}});const current=await ok('/pages/'+page.id);const r=await request(cookie1,'/pages/'+page.id,'PUT',{expectedRevision:current.revision,panels:[],utterances:current.utterances.map((u:any)=>({...u,voiceVersionId:voice.id}))});expect(r.status).toBe(422);
 });
 it('redelivers the transactional outbox without importing pages twice',async()=>{
  const imported=await db.job.findFirstOrThrow({where:{projectId:p1.id,kind:'import',status:'succeeded'}});
  await db.outboxEvent.update({where:{jobId:imported.id},data:{deliveredAt:null}});
  await new Promise(resolve=>setTimeout(resolve,3500));
  expect((await db.outboxEvent.findUniqueOrThrow({where:{jobId:imported.id}})).deliveredAt).not.toBeNull();
  expect((await db.job.findUniqueOrThrow({where:{id:imported.id}})).attempts).toBe(1);
  expect((await ok('/chapters/'+c1.id)).pages).toHaveLength(2);
 });
 it('undoes a character merge while preserving subsequent manual edits',async()=>{
  const target=await ok('/projects/'+p1.id+'/characters','POST',{name:'Target hero'});
  const merge=await ok('/characters/'+character.id+'/merge','POST',{targetId:target.id,sourceRevision:character.revision,targetRevision:target.revision,voiceVersionId:null,confirm:true});
  let current=await ok('/pages/'+page.id);expect(current.utterances[0].characterId).toBe(target.id);
  current=await ok('/pages/'+page.id,'PUT',{expectedRevision:current.revision,panels:[],utterances:current.utterances.map((u:any)=>({...u,spokenText:'Привет после объединения!'}))});
  const undo=await ok('/merges/'+merge.mergeId+'/undo','POST',{});expect(undo.conflicts).toEqual([current.utterances[0].id]);
  current=await ok('/pages/'+page.id);expect(current.utterances[0].spokenText).toBe('Привет после объединения!');expect(current.utterances[0].characterId).toBe(target.id);
  character=(await ok('/projects/'+p1.id)).characters.find((c:any)=>c.id===character.id);expect(character.status).toBe('active');
 });
 it.skipIf(process.env.MVS_INTEGRATION_GPU!=='true')('keeps real model analysis separate from manual edits and accepts one proposal',async()=>{
  let current=await ok('/pages/'+page.id);const manualId=current.utterances[0].id;
  const stale=await ok('/pages/'+page.id+'/analysis','POST',{});
  current=await ok('/pages/'+page.id,'PUT',{expectedRevision:current.revision,panels:[],utterances:current.utterances.map((u:any)=>({...u,pauseMs:u.pauseMs+1}))});
  const old=await finished(stale.jobId,'succeeded',180);expect((await ok('/pages/'+page.id)).utterances).toEqual(current.utterances);
  expect((await request(cookie1,'/analyses/'+old.result.analysisId+'/apply','POST',{expectedRevision:current.revision,utteranceIndices:[0],includePanels:false})).status).toBe(409);
  const fresh=await ok('/pages/'+page.id+'/analysis','POST',{});const analyzed=await finished(fresh.jobId,'succeeded',180);expect(analyzed.result.proposal.utterances.length).toBeGreaterThan(0);
  const accepted=await ok('/analyses/'+analyzed.result.analysisId+'/apply','POST',{expectedRevision:current.revision,utteranceIndices:[0],includePanels:false});
  expect(accepted.utterances).toHaveLength(current.utterances.length+1);expect(accepted.utterances.find((u:any)=>u.id===manualId)).toEqual(current.utterances[0]);
 },390000);
 it.skipIf(process.env.MVS_INTEGRATION_GPU!=='true')('finds first-chapter character references inside the second chapter',async()=>{
  const bbox={x:.05,y:.2,width:.4,height:.65};
  const reference=await ok('/characters/'+character.id+'/references','POST',{pageId:page.id,bbox});await finished(reference.jobId);
  await db.$executeRaw`INSERT INTO "CharacterReference" (id,"projectId","characterId","pageId",bbox,"cropKey",confirmed,"encoderRevision",embedding) SELECT ${randomUUID()},"projectId","characterId","pageId",bbox,"cropKey",confirmed,"encoderRevision",embedding FROM "CharacterReference" WHERE "projectId"=${p1.id} AND "characterId"=${character.id} LIMIT 1`;
  const c2=await ok('/projects/'+p1.id+'/chapters','POST',{title:'Chapter 2'});const form=new FormData();form.append('files',new Blob([new Uint8Array(await fs.readFile('work/fixtures/chapter-2.png'))]),'next.png');await finished((await ok('/chapters/'+c2.id+'/import','POST',form)).jobId);
  const next=(await ok('/chapters/'+c2.id)).pages[0];const candidates=await finished((await ok('/pages/'+next.id+'/candidates','POST',{bbox})).jobId);
  expect(candidates.result.candidates.length).toBeLessThanOrEqual(5);expect(candidates.result.candidates[0].characterId).toBe(character.id);
  expect(new Set(candidates.result.candidates.map((c:any)=>c.characterId)).size).toBe(candidates.result.candidates.length);
  const appearance=await db.characterAppearance.findUniqueOrThrow({where:{id:candidates.result.appearanceId}});expect(appearance.confirmedCharacterId).toBeNull();
  await ok('/appearances/'+appearance.id+'/confirm','POST',{characterId:character.id});expect((await ok('/pages/'+next.id)).utterances).toHaveLength(0);
 },90000);
 it.skipIf(process.env.MVS_INTEGRATION_GPU!=='true')('kills a running model on cancellation and retries with a new fenced job',async()=>{
  const started=await ok('/projects/'+p1.id+'/voices/design','POST',{name:'Cancellation fixture',description:'Calm Russian synthetic voice.',transcript:'Это проверка фактической отмены долгой генерации голоса.'});
  let active=false;for(let i=0;i<100;i++){const health=await fetch(process.env.AI_URL+'/health',{headers:{'X-AI-Secret':process.env.AI_SECRET!}}).then(r=>r.json()) as any;if(health.activeJob===started.jobId&&(await ok('/jobs/'+started.jobId)).progress?.phase==='generating'){active=true;break;}await new Promise(resolve=>setTimeout(resolve,500));}expect(active).toBe(true);
  const processes=await runtimeProcesses();if(process.platform==='win32')expect(processes.length).toBeGreaterThan(0);
  await ok('/jobs/'+started.jobId+'/cancel','POST',{});await finished(started.jobId,'cancelled');
  const remaining=await runtimeProcesses();expect(remaining.some(p=>processes.some(old=>p.id===old.id&&p.started===old.started))).toBe(false);
  const health=await fetch(process.env.AI_URL+'/health',{headers:{'X-AI-Secret':process.env.AI_SECRET!}}).then(r=>r.json()) as any;expect(health.activeJob).toBeNull();
  expect((await ok('/jobs/'+started.jobId)).result).toBeNull();const retried=await ok('/jobs/'+started.jobId+'/retry','POST',{});expect(retried.jobId).not.toBe(started.jobId);await finished(retried.jobId);expect((await ok('/jobs/'+started.jobId)).status).toBe('cancelled');
 },150000);
 it.skipIf(process.env.MVS_INTEGRATION_GPU!=='true')('uses a saved real voice and selectively reuses audio',async()=>{
  const design=await ok('/projects/'+p1.id+'/voices/design','POST',{name:'Fixture synthetic voice',description:'Warm calm adult voice speaking Russian clearly.',transcript:'Сегодня начинается новая история. Мы готовы идти дальше.'});await finished(design.jobId);const voice=await ok('/jobs/'+design.jobId+'/save-voice','POST',{});await ok('/characters/'+character.id,'PATCH',{expectedRevision:character.revision,defaultVoiceVersionId:voice.id});let current=await ok('/pages/'+page.id);const second={...current.utterances[0],id:randomUUID(),order:1,originalText:'Наш путь продолжается.',spokenText:'Наш путь продолжается.'};current=await ok('/pages/'+page.id,'PUT',{expectedRevision:current.revision,panels:[],utterances:[current.utterances[0],second].map(u=>({...u,included:true,voiceVersionId:voice.id}))});const jobs=await ok('/chapters/'+c1.id+'/speech','POST',{});for(const id of jobs.jobIds)await finished(id);const initial=await ok('/projects/'+p1.id+'/artifacts');expect(initial).toHaveLength(2);current=await ok('/pages/'+page.id);current=await ok('/pages/'+page.id,'PUT',{expectedRevision:current.revision,panels:[],utterances:current.utterances.map((u:any,i:number)=>i===0?{...u,spokenText:'Привет ещё раз!'}:u)});const update=await ok('/chapters/'+c1.id+'/speech','POST',{});expect(update.jobIds).toHaveLength(1);await finished(update.jobIds[0]);const render=await ok('/chapters/'+c1.id+'/render','POST',{});const rendered=await finished(render.jobId);expect(rendered.result.manifest.segments).toHaveLength(2);const wav=await fetch(origin+'/api/v1/files/'+rendered.result.fileKey,{headers:{Cookie:cookie1,Range:'bytes=0-43'}});expect(wav.status).toBe(206);expect(Buffer.from(await wav.arrayBuffer()).subarray(0,4).toString()).toBe('RIFF');expect((await fs.stat(storage.resolve(voice.referenceKey))).size).toBeGreaterThan(44);
 },180000);
 it.skipIf(process.env.MVS_INTEGRATION_GPU!=='true')('keeps VoxCPM v1 snapshots immutable and synthesizes uppercase Russian with v2 reference-only',async()=>{
  const p=await ok('/projects','POST',{title:'Russian cloning regression',textLanguage:'ru',speechLanguage:'Russian'});projectIds.push(p.id);
  const chapter=await ok('/projects/'+p.id+'/chapters','POST',{title:'Case comparison'});
  const upload=new FormData();upload.append('files',new Blob([new Uint8Array(await fs.readFile('work/fixtures/chapter-1.png'))]),'page.png');await finished((await ok('/chapters/'+chapter.id+'/import','POST',upload)).jobId);
  const pageId=(await ok('/chapters/'+chapter.id)).pages[0].id,current=await ok('/pages/'+pageId);
  const form=new FormData();form.append('file',new Blob([new Uint8Array(await fs.readFile('outputs/voice-description/default-settings/prepared-2026.wav'))],{type:'audio/wav'}),'reference.wav');
  const imported=await fetch(origin+'/api/v1/projects/'+p.id+'/voices/import',{method:'POST',headers:{Cookie:cookie1,Origin:origin,'Idempotency-Key':randomUUID(),'X-Voice-Name':encodeURIComponent('Regression voice'),'X-Transcript':encodeURIComponent('Сегодня начинается новая история. Я готов идти вперёд, даже если путь окажется непростым.'),'X-Rights-Confirmed':'true'},body:form});const importedBody=await imported.json() as any;expect(imported.status,JSON.stringify(importedBody)).toBe(202);
  const voice=(await finished(importedBody.jobId)).result.voiceVersion;
  const utterance={id:randomUUID(),panelId:null,bbox:{x:.1,y:.1,width:.4,height:.1},order:0,kind:'dialogue',originalText:'Я ТУТ ДУМАТЬ ПЫТАЮСЬ, НЕ МЕШАЙ.',spokenText:'Я ТУТ ДУМАТЬ ПЫТАЮСЬ, НЕ МЕШАЙ.',characterId:null,voiceVersionId:voice.id,pauseMs:200,included:true,reviewStatus:'reviewed',revision:0};
  const saved=await ok('/pages/'+pageId,'PUT',{expectedRevision:current.revision,panels:[],utterances:[utterance]});
  const {synthesisText:_text,textPreparationVersion:_prep,cloningMode:_mode,...canonical}=speechInput(user1,p.id,utterance,voice,'Russian',(await prepareSpeechTexts([utterance.spokenText],'Russian'))[0]);
  const input={projectId:p.id,pageId,utteranceId:utterance.id,utteranceRevision:saved.utterances[0].revision,referenceKey:voice.referenceKey,referenceText:voice.transcript,canonical:{...canonical,adapterVersion:'voxcpm2-v1'}};
  const old=await db.$transaction(async tx=>{const job=await tx.job.create({data:{projectId:p.id,ownerId:user1,kind:'speech',input,idempotencyKey:randomUUID()}});await tx.outboxEvent.create({data:{jobId:job.id}});return job;});
  const historical=await finished(old.id);expect(historical.input).toEqual(input);expect(historical.result.adapterVersion).toBe('voxcpm2-v1');expect((await ok('/pages/'+pageId)).utterances[0].activeAudioId).toBeNull();
  const generated=await finished((await ok('/utterances/'+utterance.id+'/speech','POST',{})).jobId);
  expect(generated.input.canonical).toMatchObject({...speechModel,spokenText:utterance.spokenText,synthesisText:'Я тут думать пытаюсь, не мешай.',cloningMode:'reference-only',textPreparationVersion:'ru-numbers-v1'});
  expect(generated.result).toMatchObject({adapterVersion:'voxcpm2-v2',synthesisText:'Я тут думать пытаюсь, не мешай.',cloningMode:'reference-only'});
  expect((await ok('/pages/'+pageId)).utterances[0]).toMatchObject({spokenText:utterance.spokenText,activeAudioId:generated.result.artifactId});
  expect((await request(cookie1,'/utterances/'+utterance.id+'/audio','POST',{artifactId:historical.result.artifactId,expectedRevision:saved.utterances[0].revision})).status).toBe(422);
  const reused=await finished((await ok('/utterances/'+utterance.id+'/speech','POST',{})).jobId);expect(reused.result.cached).toBe(true);expect(reused.result.synthesisText).toBe('Я тут думать пытаюсь, не мешай.');
  const publicJobs=await ok('/projects/'+p.id+'/job-progress');expect(publicJobs.jobs.find((j:any)=>j.id===generated.id).synthesis).toMatchObject({cloningMode:'reference-only',synthesisText:'Я тут думать пытаюсь, не мешай.'});
  expect((await request(cookie2,'/projects/'+p.id+'/job-progress')).status).toBe(404);
  const render=await finished((await ok('/chapters/'+chapter.id+'/render','POST',{})).jobId);expect(render.result.manifest.segments[0].text).toBe(utterance.spokenText);
 },150000);
 it.skipIf(process.env.MVS_INTEGRATION_GPU!=='true')('executes an immutable legacy Qwen job then requires VoxCPM audio for a new render',async()=>{
  const p=await ok('/projects','POST',{title:'Legacy migration fixture',textLanguage:'ru',speechLanguage:'Russian'});projectIds.push(p.id);
  const chapter=await ok('/projects/'+p.id+'/chapters','POST',{title:'Migration'});
  const upload=new FormData();upload.append('files',new Blob([new Uint8Array(await fs.readFile('work/fixtures/chapter-1.png'))]),'page.png');await finished((await ok('/chapters/'+chapter.id+'/import','POST',upload)).jobId);
  const pageId=(await ok('/chapters/'+chapter.id)).pages[0].id,current=await ok('/pages/'+pageId);
  const referenceKey=p.id+'/voices/legacy.wav';await storage.write(referenceKey,await fs.readFile('outputs/voice-description/default-settings/prepared-2026.wav'));
  const oldDesign=await db.job.create({data:{projectId:p.id,ownerId:user1,kind:'voice_design',status:'succeeded',stage:'complete',idempotencyKey:randomUUID(),input:{name:'Legacy reference',description:'Low adult male voice.',transcript:'Сегодня начинается новая история. Я готов идти вперёд, даже если путь окажется непростым.',language:'Russian'},result:{fileKey:referenceKey,checksum:createHash('sha256').update(await storage.read(referenceKey)).digest('hex'),modelRevision:'5ecdb67327fd37bb2e042aab12ff7391903235d3'}}});
  const voice=await ok('/jobs/'+oldDesign.id+'/save-voice','POST',{});expect(voice.settings.description).toBe('Low adult male voice.');
  const utterance={id:randomUUID(),panelId:null,bbox:{x:.1,y:.1,width:.4,height:.1},order:0,kind:'narration',originalText:'История продолжается.',spokenText:'История продолжается.',characterId:null,voiceVersionId:voice.id,pauseMs:200,included:true,reviewStatus:'reviewed',revision:0};
  const saved=await ok('/pages/'+pageId,'PUT',{expectedRevision:current.revision,panels:[],utterances:[utterance]});
  const {modelId:_id,adapterVersion:_adapter,...base}=speechInput(user1,p.id,utterance,voice,'Russian',(await prepareSpeechTexts([utterance.spokenText],'Russian'))[0]);
  const input={projectId:p.id,pageId,utteranceId:utterance.id,utteranceRevision:saved.utterances[0].revision,referenceKey,referenceText:voice.transcript,canonical:{...base,modelRevision:'fd4b254389122332181a7c3db7f27e918eec64e3',settings:{}}};
  const legacy=await db.$transaction(async tx=>{const job=await tx.job.create({data:{projectId:p.id,ownerId:user1,kind:'speech',input,idempotencyKey:randomUUID()}});await tx.outboxEvent.create({data:{jobId:job.id}});return job;});
  const result=await finished(legacy.id);expect(result.input).toEqual(input);expect(result.result.modelId).toBe('Qwen/Qwen3-TTS-12Hz-1.7B-Base');
  expect((await request(cookie1,'/files/'+result.result.fileKey)).status).toBe(200);
  const stale=await finished((await ok('/chapters/'+chapter.id+'/render','POST',{})).jobId,'failed');expect(stale.error).toMatch(/устарело|актуальное аудио/);
  const newer=await ok('/chapters/'+chapter.id+'/speech','POST',{});expect(newer.jobIds).toHaveLength(1);const voiced=await finished(newer.jobIds[0]);expect(voiced.input.canonical).toMatchObject(speechModel);expect(voiced.result.modelId).toBe(speechModel.modelId);
  expect((await request(cookie1,'/files/'+result.result.fileKey)).status).toBe(200);expect((await ok('/pages/'+pageId)).utterances[0].activeAudioId).toBe(voiced.result.artifactId);
  await finished((await ok('/chapters/'+chapter.id+'/render','POST',{})).jobId);
 },180000);
 it.skipIf(process.env.MVS_INTEGRATION_GPU!=='true')('invalidates exports after speaker rename or speech language changes',async()=>{
  const before=await ok('/pages/'+page.id),chapter=await ok('/chapters/'+c1.id),previous=chapter.renders.find((r:any)=>r.inputRevision===chapter.revision);
  expect(previous).toBeDefined();const audioIds=before.utterances.map((u:any)=>u.activeAudioId),project=await ok('/projects/'+p1.id);
  const speaker=project.characters.find((c:any)=>c.id===before.utterances[0].characterId);
  await ok('/characters/'+speaker.id,'PATCH',{expectedRevision:speaker.revision,name:'Переименованный герой'});
  expect((await request(cookie1,'/files/'+previous.fileKey)).status).toBe(409);
  expect((await ok('/pages/'+page.id)).utterances.map((u:any)=>u.activeAudioId)).toEqual(audioIds);
  const render=await finished((await ok('/chapters/'+c1.id+'/render','POST',{})).jobId);
  expect(render.result.manifest.segments[0].character.name).toBe('Переименованный герой');
  await ok('/projects/'+p1.id,'PATCH',{...project,speechLanguage:'English',expectedRevision:project.revision});
  expect((await request(cookie1,'/files/'+render.result.fileKey)).status).toBe(409);
  const after=await ok('/pages/'+page.id);expect(after.utterances.every((u:any)=>u.activeAudioId===null)).toBe(true);
  expect(after.utterances[0].revision).toBeGreaterThan(before.utterances[0].revision);
  expect((await request(cookie1,'/pages/'+page.id,'PUT',{expectedRevision:before.revision,panels:before.panels,utterances:before.utterances})).status).toBe(409);
 },30000);
});
