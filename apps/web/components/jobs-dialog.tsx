'use client';
import { useEffect,useRef,useState,type ReactNode } from 'react';
import { activeStatuses,phaseLabels,jobLabels,jobPhases,type ProgressJob,type batchSummarySchema } from '@mvs/contracts';
import type { z } from 'zod';
import { Button } from './button';
export type PendingRequest={id:string;name:string;startedAt:number};
function elapsed(start:number,now:number){const seconds=Math.max(0,Math.floor((now-start)/1000));return `${Math.floor(seconds/60)} min ${seconds%60} s`;}
export function JobsDialog({jobs,batches,pending,error,loading,onClose,actions}:{jobs:ProgressJob[];batches:z.infer<typeof batchSummarySchema>[];pending:PendingRequest[];error:boolean;loading:boolean;onClose:()=>void;actions:(job:ProgressJob)=>ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),close=useRef(onClose);close.current=onClose;const [now,setNow]=useState(0);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current;dialog?.showModal();const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,1000);return()=>{clearInterval(timer);dialog?.close();previous?.focus();};},[]);
 const active=jobs.filter(j=>activeStatuses.includes(j.status)),recent=jobs.filter(j=>!activeStatuses.includes(j.status));
 const card=(j:ProgressJob)=>{const running=activeStatuses.includes(j.status),phase=j.progress?.phase||j.stage,phases=jobPhases(j.kind),done=j.progress?.completedPhases||[],count=j.progress?.completed,total=j.progress?.total;
  return <article key={j.id} className="progress-card" data-job-id={j.id}><div className="row spread"><strong>{jobLabels[j.kind]||j.kind}{j.name?` · ${j.name}`:''}</strong><span className={'job-state state-'+j.status}>{j.status==='running'?'Running':j.status==='succeeded'?'Complete':phaseLabels[j.status]||j.status}</span></div>
   <p className="progress-current">{phaseLabels[phase]||jobLabels[phase]||phase}{count!==undefined&&total!==undefined?` · ${count} of ${total} ${{pages:'pages',chunks:'chunks',segments:'segments',files:'files'}[j.progress!.unit||'files']}`:''}</p>
   {running&&<progress aria-label={'Progress: '+(jobLabels[j.kind]||j.kind)} {...(total?{value:count,max:total}:{})}/>}
   <ol className="job-steps">{phases.filter(p=>p!=='queued'&&p!=='complete').map(p=><li key={p} className={done.includes(p)?'done':p===phase?'current':''}><span aria-hidden="true">{done.includes(p)?'✓':p===phase?'●':'○'}</span> {phaseLabels[p]}</li>)}</ol>{j.result?.cached===true&&<p className="status">Current audio was reused from the cache.</p>}
   <p className="status">{running?'Elapsed':'Duration'}: {elapsed(Date.parse(j.createdAt),running?now:Date.parse(j.updatedAt))} · attempt {j.attempts}{j.progress&&running?` · updated ${elapsed(Date.parse(j.progress.updatedAt),now)} ago`:''}</p>
   {j.error&&<p className="error">{j.error}</p>}
   {j.synthesis&&<details><summary>Speech model and settings</summary><p>{String(j.result?.modelId||j.synthesis.modelId||'Qwen/Qwen3-TTS-12Hz-1.7B-Base')}</p><p className="status">Revision: {String(j.result?.modelRevision||j.synthesis.modelRevision)}{j.synthesis.adapterVersion?` · ${j.synthesis.adapterVersion}`:''}</p><pre>{JSON.stringify(j.result?.generationSettings||j.synthesis.generationSettings||{},null,2)}</pre></details>}
   {j.description&&<details><summary>Voice description and instruction</summary><p>{j.description}</p>{typeof j.result?.effectiveInstruction==='string'?<><strong>Voice design instruction</strong><p lang="en">{j.result.effectiveInstruction}</p><p className="status">Preparation: {String(j.result.promptVersion)} · model {String(j.result.promptModelRevision)}</p></>:<p>The instruction appears after preparation and generation finish.</p>}</details>}
   {j.synthesis?.synthesisText&&<details><summary>Synthesis text and mode</summary><p>{j.synthesis.synthesisText}</p><p className="status">{j.synthesis.cloningMode==='reference-only'?'Reference-only voice cloning':'Audio continuation'} · {j.synthesis.textPreparationVersion}</p></details>}{actions(j)}
  </article>;
 };
 return <dialog ref={ref} className="jobs-dialog" aria-labelledby="jobs-title" onCancel={e=>{e.preventDefault();close.current();}}><div className="jobs-heading row spread"><div><h2 id="jobs-title">Project jobs</h2><span className="status">{active.length} pending · {recent.length} recent results</span></div><Button variant="secondary" onClick={onClose} autoFocus>Close</Button></div>
  <div className="jobs-content">{error&&<p role="status" className="error">Connection lost. Showing the last known state; the data may be stale.</p>}{loading&&<p role="status">Loading jobs…</p>}
   {pending.map(p=><article className="progress-card" key={p.id}><strong>{p.name}</strong><p>Uploading files / sending request · {elapsed(p.startedAt,now)}</p><progress aria-label='Sending request'/></article>)}
   {batches.map(b=><article className="batch-card" key={b.id}><strong>Chapter speech · batch {b.id.slice(0,8)}</strong><p>Completed {b.succeeded} of {b.total} utterances · active / queued: {b.active} · failed: {b.failed} · cancelled: {b.cancelled}</p>{b.total>0&&<progress aria-label='Batch progress' max={b.total} value={b.succeeded+b.failed+b.cancelled}/>} {b.remaining>0&&<p>Another {b.remaining} utterances remain outside this batch. Start the next batch after completion.</p>}</article>)}
   {active.length>0&&<><h3>Active and queued</h3>{active.map(card)}</>}{recent.length>0&&<><h3>Recent results</h3>{recent.map(card)}</>}{!loading&&!jobs.length&&!pending.length&&<p>No jobs yet. Import, analysis, voice design and speech progress will appear here.</p>}
  </div>
 </dialog>;
}
