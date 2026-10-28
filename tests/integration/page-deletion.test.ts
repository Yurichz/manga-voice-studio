import 'dotenv/config';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { randomUUID,randomBytes } from 'node:crypto';
import { db } from '@mvs/database';
import { makeAuth } from '../../apps/api/src/auth.js';
import { writeJobProgress } from '../../apps/worker/src/progress.js';

describe.skipIf(process.env.MVS_RUN_INTEGRATION!=='true')('page deletion with real PostgreSQL/API',()=>{
 const origin=process.env.BETTER_AUTH_URL||'http://localhost:3000';
 let owner:string,other:string,cookie:string,otherCookie:string,projectId:string,foreignProjectId:string;
 async function request(session:string,path:string,method='GET',body?:unknown){
  const response=await fetch(origin+'/api/v1'+path,{method,headers:{Cookie:session,Origin:origin,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json() as any};
 }
 beforeAll(async()=>{
  async function account(){const email=randomUUID()+'@mvs-test.invalid',password=randomBytes(24).toString('base64url');const created=await makeAuth(true).api.signUpEmail({body:{name:'Page deletion fixture',email,password}});const response=await fetch(origin+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password})});expect(response.status).toBe(200);return {id:created.user.id,cookie:response.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')};}
  const a=await account(),b=await account();owner=a.id;cookie=a.cookie;other=b.id;otherCookie=b.cookie;
  projectId=(await db.project.create({data:{ownerId:owner,title:'Page deletion verification'}})).id;
  foreignProjectId=(await db.project.create({data:{ownerId:other,title:'Foreign deletion fixture'}})).id;
 },30000);
 afterAll(async()=>{
  for(const id of [projectId,foreignProjectId].filter(Boolean)){await db.utterance.deleteMany({where:{projectId:id}});await db.page.deleteMany({where:{projectId:id}});await db.project.delete({where:{id}});}
  for(const id of [owner,other].filter(Boolean))await db.user.delete({where:{id}});
  await db.$disconnect();
 },30000);
 async function fixture(){
  const chapter=await db.chapter.create({data:{projectId,title:'Three pages',order:0}});
  const pages=[];for(let order=0;order<3;order++)pages.push(await db.page.create({data:{projectId,chapterId:chapter.id,order,name:`${order+1}.png`,width:100,height:100,imageKey:projectId+`/${order}.png`,previewKey:projectId+`/${order}.webp`,sourceKey:projectId+`/${order}.source`,checksum:'fixture',transform:{}}}));
  return {chapter,pages};
 }
 it('requires confirmation, ownership and current revision without cancelling jobs on rejection',async()=>{
  const {pages}=await fixture(),page=pages[1];
  const job=await db.job.create({data:{projectId,ownerId:owner,kind:'analysis',input:{pageId:page.id},idempotencyKey:randomUUID()}});
  expect((await request(otherCookie,'/pages/'+page.id,'DELETE',{confirm:true,expectedRevision:0})).status).toBe(404);
  expect((await request(cookie,'/pages/'+page.id,'DELETE',{confirm:false,expectedRevision:0})).status).toBe(422);
  expect((await request(cookie,'/pages/'+page.id,'DELETE',{confirm:true,expectedRevision:1})).status).toBe(409);
  expect((await db.job.findUniqueOrThrow({where:{id:job.id}})).status).toBe('queued');
  expect(await db.page.findUnique({where:{id:page.id}})).not.toBeNull();
 });
 it('deletes annotations, cancels affected attempts, preserves other work and compacts order',async()=>{
  const {chapter,pages}=await fixture(),page=pages[1],bbox={x:.1,y:.1,width:.3,height:.2};
  const panel=await db.panel.create({data:{id:randomUUID(),projectId,pageId:page.id,bbox,order:0,source:'manual'}});
  const utterance=await db.utterance.create({data:{id:randomUUID(),projectId,pageId:page.id,panelId:panel.id,bbox,order:0,kind:'dialogue',originalText:'Тест',spokenText:'Тест'}});
  await db.analysisRun.create({data:{projectId,pageId:page.id,inputRevision:0,modelRevision:'fixture',promptVersion:'fixture',proposal:{panels:[],utterances:[],characters:[]}}});
  const specs=[{kind:'analysis',status:'queued',input:{pageId:page.id}},{kind:'speech',status:'running',input:{pageId:page.id,utteranceId:utterance.id}},{kind:'candidates',status:'blocked',input:{pageId:page.id}},{kind:'render',status:'queued',input:{chapterId:chapter.id}},{kind:'analysis',status:'queued',input:{pageId:pages[0].id}},{kind:'analysis',status:'succeeded',input:{pageId:page.id}}];
  const jobs=[];for(const spec of specs)jobs.push(await db.job.create({data:{...spec,projectId,ownerId:owner,attemptToken:spec.status==='running'?'delete-attempt':null,heartbeatAt:new Date(),idempotencyKey:randomUUID()}}));
  const foreign=await db.job.create({data:{projectId:foreignProjectId,ownerId:other,kind:'analysis',status:'queued',input:{pageId:page.id},idempotencyKey:randomUUID()}});
  const response=await request(cookie,'/pages/'+page.id,'DELETE',{confirm:true,expectedRevision:0});
  expect(response).toMatchObject({status:200,data:{deleted:true,cancelRequested:4}});
  expect((await request(cookie,'/pages/'+page.id)).status).toBe(404);
  expect(await db.utterance.count({where:{pageId:page.id}})).toBe(0);expect(await db.panel.count({where:{pageId:page.id}})).toBe(0);expect(await db.analysisRun.count({where:{pageId:page.id}})).toBe(0);
  const remaining=await db.page.findMany({where:{chapterId:chapter.id},orderBy:{order:'asc'}});expect(remaining.map(p=>p.id)).toEqual([pages[0].id,pages[2].id]);expect(remaining.map(p=>p.order)).toEqual([0,1]);
  expect((await db.chapter.findUniqueOrThrow({where:{id:chapter.id}})).revision).toBe(1);
  for(const i of [0,2,3])expect((await db.job.findUniqueOrThrow({where:{id:jobs[i].id}})).status).toBe('cancelled');
  expect((await db.job.findUniqueOrThrow({where:{id:jobs[1].id}})).status).toBe('cancel_requested');
  expect((await writeJobProgress(jobs[1].id,'delete-attempt',{phase:'publishing',updatedAt:new Date().toISOString()})).count).toBe(0);
  expect((await db.job.findUniqueOrThrow({where:{id:jobs[4].id}})).status).toBe('queued');expect((await db.job.findUniqueOrThrow({where:{id:jobs[5].id}})).status).toBe('succeeded');expect((await db.job.findUniqueOrThrow({where:{id:foreign.id}})).status).toBe('queued');
  expect((await request(cookie,'/jobs/'+jobs[0].id+'/retry','POST',{})).status).toBe(404);
  expect((await request(cookie,'/pages/'+page.id+'/analysis','POST',{})).status).toBe(404);
  await db.job.update({where:{id:jobs[1].id},data:{status:'cancelled'}});
 });
 it('rejects an entire bulk request on invalid input, ownership, membership or a stale page',async()=>{
  const {chapter,pages}=await fixture(),another=await fixture();
  const selected=pages.slice(0,2).map(p=>({id:p.id,expectedRevision:0}));
  const job=await db.job.create({data:{projectId,ownerId:owner,kind:'analysis',input:{pageId:pages[0].id},idempotencyKey:randomUUID()}});
  const endpoint='/chapters/'+chapter.id+'/pages';
  expect((await request(otherCookie,endpoint,'DELETE',{pages:selected,confirm:true})).status).toBe(404);
  for(const body of [{pages:[],confirm:true},{pages:[selected[0],selected[0]],confirm:true},{pages:selected,confirm:false},{pages:[{...selected[0],expectedRevision:-1}],confirm:true},{pages:Array.from({length:51},()=>({id:randomUUID(),expectedRevision:0})),confirm:true}])expect((await request(cookie,endpoint,'DELETE',body)).status).toBe(422);
  for(const id of [another.pages[0].id,randomUUID()])expect((await request(cookie,endpoint,'DELETE',{pages:[selected[0],{id,expectedRevision:0}],confirm:true})).status).toBe(404);
  await db.page.update({where:{id:pages[1].id},data:{revision:1}});
  expect((await request(cookie,endpoint,'DELETE',{pages:selected,confirm:true})).status).toBe(409);
  expect(await db.page.count({where:{chapterId:chapter.id}})).toBe(3);
  expect((await db.chapter.findUniqueOrThrow({where:{id:chapter.id}})).revision).toBe(0);
  expect((await db.job.findUniqueOrThrow({where:{id:job.id}})).status).toBe('queued');
 });
 it('deletes non-adjacent pages atomically, cancels both pages and renders once, then allows an empty chapter',async()=>{
  const {chapter,pages}=await fixture(),bbox={x:.1,y:.1,width:.3,height:.2};
  for(const p of pages){const panel=await db.panel.create({data:{id:randomUUID(),projectId,pageId:p.id,bbox,order:0,source:'manual'}});await db.utterance.create({data:{id:randomUUID(),projectId,pageId:p.id,panelId:panel.id,bbox,order:0,kind:'dialogue',originalText:'Тест',spokenText:'Тест'}});}
  const specs=[{kind:'analysis',status:'queued',input:{pageId:pages[0].id}},{kind:'speech',status:'running',input:{pageId:pages[2].id}},{kind:'render',status:'blocked',input:{chapterId:chapter.id}},{kind:'analysis',status:'queued',input:{pageId:pages[1].id}}];
  const jobs=[];for(const spec of specs)jobs.push(await db.job.create({data:{...spec,projectId,ownerId:owner,attemptToken:spec.status==='running'?'bulk-attempt':null,idempotencyKey:randomUUID()}}));
  const endpoint='/chapters/'+chapter.id+'/pages';
  expect(await request(cookie,endpoint,'DELETE',{pages:[pages[0],pages[2]].map(p=>({id:p.id,expectedRevision:0})),confirm:true})).toMatchObject({status:200,data:{deleted:true,deletedCount:2,cancelRequested:3}});
  const remaining=await db.page.findMany({where:{chapterId:chapter.id}});expect(remaining.map(p=>[p.id,p.order])).toEqual([[pages[1].id,0]]);
  expect(await db.utterance.count({where:{pageId:{in:[pages[0].id,pages[2].id]}}})).toBe(0);expect(await db.panel.count({where:{pageId:{in:[pages[0].id,pages[2].id]}}})).toBe(0);
  expect(await db.utterance.count({where:{pageId:pages[1].id}})).toBe(1);expect((await db.chapter.findUniqueOrThrow({where:{id:chapter.id}})).revision).toBe(1);
  expect((await db.job.findUniqueOrThrow({where:{id:jobs[0].id}})).status).toBe('cancelled');expect((await db.job.findUniqueOrThrow({where:{id:jobs[1].id}})).status).toBe('cancel_requested');expect((await db.job.findUniqueOrThrow({where:{id:jobs[2].id}})).status).toBe('cancelled');expect((await db.job.findUniqueOrThrow({where:{id:jobs[3].id}})).status).toBe('queued');
  expect((await writeJobProgress(jobs[1].id,'bulk-attempt',{phase:'publishing',updatedAt:new Date().toISOString()})).count).toBe(0);
  expect((await request(cookie,'/jobs/'+jobs[0].id+'/retry','POST',{})).status).toBe(404);
  expect(await request(cookie,endpoint,'DELETE',{pages:[{id:pages[1].id,expectedRevision:0}],confirm:true})).toMatchObject({status:200,data:{deletedCount:1,cancelRequested:1}});
  expect(await db.page.count({where:{chapterId:chapter.id}})).toBe(0);expect((await db.chapter.findUniqueOrThrow({where:{id:chapter.id}})).revision).toBe(2);
  await db.job.update({where:{id:jobs[1].id},data:{status:'cancelled'}});
 });
});
