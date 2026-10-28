import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {promises as fs} from 'node:fs';
import {spawn} from 'node:child_process';
import {db} from '@mvs/database';
import {makeAuth} from '../apps/api/src/auth.js';
import {storage} from '../packages/storage/src/index.js';
const origin=process.env.BETTER_AUTH_URL||'http://localhost:3000';
let userId='',projectId='',cookie='',workerStopped=false;
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function request(endpoint:string,body?:unknown){const r=await fetch(origin+'/api/v1'+endpoint,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:body===undefined?undefined:JSON.stringify(body)});const data:any=await r.json();assert(r.ok,data.error?.message);return data;}
async function health(){return fetch(process.env.AI_URL+'/health',{headers:{'X-AI-Secret':process.env.AI_SECRET!}}).then(r=>r.json()) as Promise<any>;}
async function wait<T>(fn:()=>Promise<T>,matches:(v:T)=>boolean,timeout=100000){const until=Date.now()+timeout;while(Date.now()<until){const v=await fn();if(matches(v))return v;await pause(1000);}throw new Error('Recovery verification timed out');}
async function control(start:boolean){
 const code=start?String.raw`. .\scripts\env.ps1
$records=Get-Content -LiteralPath 'work\processes.json' -Raw | ConvertFrom-Json
$old=$records | Where-Object Name -eq 'worker'
if (!$old) { throw 'Owned worker record missing' }
$existing=Get-Process -Id $old.Pid -ErrorAction SilentlyContinue
if ($existing -and $existing.StartTime.ToUniversalTime().ToString('o') -eq $old.Started) { throw 'Worker still running' }
$p=Start-Process -FilePath 'node' -ArgumentList @('--import','tsx','apps/worker/src/main.ts') -WorkingDirectory $ProjectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput 'work/worker.log' -RedirectStandardError 'work/worker.err.log'
$records=@($records | Where-Object Name -ne 'worker')+@(@{Pid=$p.Id;Name='worker';Started=$p.StartTime.ToUniversalTime().ToString('o')})
$records | ConvertTo-Json | Set-Content -LiteralPath 'work\processes.json'`:String.raw`. .\scripts\env.ps1
$records=Get-Content -LiteralPath 'work\processes.json' -Raw | ConvertFrom-Json
$record=$records | Where-Object Name -eq 'worker'
if (!$record) { throw 'Owned worker record missing' }
$p=Get-Process -Id $record.Pid -ErrorAction SilentlyContinue
if (!$p -or $p.StartTime.ToUniversalTime().ToString('o') -ne $record.Started) { throw 'Owned worker identity differs' }
Stop-Process -Id $p.Id -Force`;
 await new Promise<void>((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','RemoteSigned','-Command',code],{cwd:process.cwd(),stdio:'ignore',windowsHide:true});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(new Error('Owned worker control failed: '+code)));});workerStopped=!start;
}
async function main(){
 const email=randomUUID()+'@mvs-test.invalid',password=randomBytes(24).toString('base64url');
 userId=(await makeAuth(true).api.signUpEmail({body:{email,password,name:'Recovery verification'}})).user.id;
 const login=await fetch(origin+'/api/auth/sign-in/email',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert(login.ok);cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');
 projectId=(await request('/projects',{title:'Recovery verification'})).id;
 const design=await request('/projects/'+projectId+'/voices/design',{name:'Recovery voice',description:'A clear calm female narrator voice, natural Russian pronunciation.',transcript:'Сегодня начинается новая история.'});
 await wait(health,h=>h.activeJob===design.jobId);await control(false);
 console.log('Stopped the owned worker during real VoiceDesign inference; supervisor remains running.');
 await wait(health,h=>!h.activeJob);const stale=await db.job.findUniqueOrThrow({where:{id:design.jobId}});assert.equal(stale.status,'running');assert.equal(stale.result,null);
 await pause(Math.max(0,65000-(Date.now()-stale.heartbeatAt!.getTime())));await control(true);
 await wait(()=>request('/jobs/'+design.jobId),j=>j.status==='failed');
 const retry=await request('/jobs/'+design.jobId+'/retry',{});assert.notEqual(retry.jobId,design.jobId);
 const finished=await wait(()=>request('/jobs/'+retry.jobId),j=>['succeeded','failed','blocked'].includes(j.status));assert.equal(finished.status,'succeeded',finished.error);assert.equal((await request('/jobs/'+design.jobId)).result,null);
 const fenced=await request('/projects/'+projectId+'/voices/design',{name:'Fenced voice',description:'A gentle calm female narrator voice.',transcript:'Проверка запоздавшего результата.'});await wait(health,h=>h.activeJob===fenced.jobId);
 await db.job.update({where:{id:fenced.jobId},data:{attemptToken:randomUUID(),status:'failed',error:'Verification replaced attempt token'}});await wait(health,h=>!h.activeJob);await pause(2500);
 const rejected=await request('/jobs/'+fenced.jobId);assert.equal(rejected.status,'failed');assert.equal(rejected.result,null);
 await fs.mkdir('outputs/recovery',{recursive:true});await fs.writeFile('outputs/recovery/verification.json',JSON.stringify({passed:true,actualWorkerKilledDuringGpuInference:true,supervisorCompletedWithoutPublishing:true,staleHeartbeatDetected:true,explicitRetryNewId:true,realVoiceDesignRetry:true,lateAttemptRejected:true},null,2));
 console.log('Real worker crash, heartbeat recovery, fresh retry and late-attempt fencing passed.');
}
async function cleanup(){if(workerStopped)await control(true);if(projectId){const ids=(await db.job.findMany({where:{projectId},select:{id:true}})).map(x=>x.id);const active=(await health()).activeJob;if(ids.includes(active))await fetch(process.env.AI_URL+'/cancel/'+active,{method:'POST',headers:{'X-AI-Secret':process.env.AI_SECRET!}});await db.project.deleteMany({where:{id:projectId}});await storage.removeProject(projectId);}if(userId)await db.user.deleteMany({where:{id:userId}});await db.$disconnect();}
void main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(cleanup);
