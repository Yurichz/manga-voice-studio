'use client';
import { useEffect,useRef,useState,type ReactNode } from 'react';
import { activeStatuses,phaseLabels,jobLabels,jobPhases,type ProgressJob,type batchSummarySchema } from '@mvs/contracts';
import type { z } from 'zod';
import { Button } from './button';
export type PendingRequest={id:string;name:string;startedAt:number};
function elapsed(start:number,now:number){const seconds=Math.max(0,Math.floor((now-start)/1000));return `${Math.floor(seconds/60)} мин ${seconds%60} с`;}
export function JobsDialog({jobs,batches,pending,error,loading,onClose,actions}:{jobs:ProgressJob[];batches:z.infer<typeof batchSummarySchema>[];pending:PendingRequest[];error:boolean;loading:boolean;onClose:()=>void;actions:(job:ProgressJob)=>ReactNode}){
 const ref=useRef<HTMLDialogElement>(null),close=useRef(onClose);close.current=onClose;const [now,setNow]=useState(0);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current;dialog?.showModal();const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,1000);return()=>{clearInterval(timer);dialog?.close();previous?.focus();};},[]);
 const active=jobs.filter(j=>activeStatuses.includes(j.status)),recent=jobs.filter(j=>!activeStatuses.includes(j.status));
 const card=(j:ProgressJob)=>{const running=activeStatuses.includes(j.status),phase=j.progress?.phase||j.stage,phases=jobPhases(j.kind),done=j.progress?.completedPhases||[],count=j.progress?.completed,total=j.progress?.total;
  return <article key={j.id} className="progress-card" data-job-id={j.id}><div className="row spread"><strong>{jobLabels[j.kind]||j.kind}{j.name?` · ${j.name}`:''}</strong><span className={'job-state state-'+j.status}>{j.status==='running'?'Выполняется':j.status==='succeeded'?'Готово':phaseLabels[j.status]||j.status}</span></div>
   <p className="progress-current">{phaseLabels[phase]||jobLabels[phase]||phase}{count!==undefined&&total!==undefined?` · ${count} из ${total} ${{pages:'страниц',chunks:'фрагментов',segments:'сегментов',files:'файлов'}[j.progress!.unit||'files']}`:''}</p>
   {running&&<progress aria-label={'Прогресс: '+(jobLabels[j.kind]||j.kind)} {...(total?{value:count,max:total}:{})}/>}
   <ol className="job-steps">{phases.filter(p=>p!=='queued'&&p!=='complete').map(p=><li key={p} className={done.includes(p)?'done':p===phase?'current':''}><span aria-hidden="true">{done.includes(p)?'✓':p===phase?'●':'○'}</span> {phaseLabels[p]}</li>)}</ol>{j.result?.cached===true&&<p className="status">Готовое аудио взято из кэша.</p>}
   <p className="status">{running?'Прошло':'Длительность'}: {elapsed(Date.parse(j.createdAt),running?now:Date.parse(j.updatedAt))} · попытка {j.attempts}{j.progress&&running?` · обновлено ${elapsed(Date.parse(j.progress.updatedAt),now)} назад`:''}</p>
   {j.error&&<p className="error">{j.error}</p>}
   {j.synthesis&&<details><summary>Модель и параметры озвучки</summary><p>{String(j.result?.modelId||j.synthesis.modelId||'Qwen/Qwen3-TTS-12Hz-1.7B-Base')}</p><p className="status">Revision: {String(j.result?.modelRevision||j.synthesis.modelRevision)}{j.synthesis.adapterVersion?` · ${j.synthesis.adapterVersion}`:''}</p><pre>{JSON.stringify(j.result?.generationSettings||j.synthesis.generationSettings||{},null,2)}</pre></details>}
   {j.description&&<details><summary>Описание и инструкция голоса</summary><p>{j.description}</p>{typeof j.result?.effectiveInstruction==='string'?<><strong>Инструкция для создания голоса</strong><p lang="en">{j.result.effectiveInstruction}</p><p className="status">Подготовка: {String(j.result.promptVersion)} · модель {String(j.result.promptModelRevision)}</p></>:<p>Инструкция появится после завершения подготовки и генерации.</p>}</details>}
   {j.synthesis?.synthesisText&&<details><summary>Текст и режим синтеза</summary><p>{j.synthesis.synthesisText}</p><p className="status">{j.synthesis.cloningMode==='reference-only'?'Голосовой референс без продолжения речи':'Продолжение речи'} · {j.synthesis.textPreparationVersion}</p></details>}{actions(j)}
  </article>;
 };
 return <dialog ref={ref} className="jobs-dialog" aria-labelledby="jobs-title" onCancel={e=>{e.preventDefault();close.current();}}><div className="jobs-heading row spread"><div><h2 id="jobs-title">Задания проекта</h2><span className="status">{active.length} незавершённых · {recent.length} последних результатов</span></div><Button variant="secondary" onClick={onClose} autoFocus>Закрыть</Button></div>
  <div className="jobs-content">{error&&<p role="status" className="error">Связь с сервером потеряна. Показано последнее известное состояние; данные могут быть устаревшими.</p>}{loading&&<p role="status">Загрузка заданий…</p>}
   {pending.map(p=><article className="progress-card" key={p.id}><strong>{p.name}</strong><p>Отправка файлов / запроса · {elapsed(p.startedAt,now)}</p><progress aria-label="Отправка запроса"/></article>)}
   {batches.map(b=><article className="batch-card" key={b.id}><strong>Озвучка главы · пакет {b.id.slice(0,8)}</strong><p>Готово {b.succeeded} из {b.total} реплик · выполняется / ожидает: {b.active} · ошибок: {b.failed} · отменено: {b.cancelled}</p>{b.total>0&&<progress aria-label="Прогресс пакета" max={b.total} value={b.succeeded+b.failed+b.cancelled}/>} {b.remaining>0&&<p>Ещё {b.remaining} реплик за пределами этого пакета. Запустите следующий пакет после завершения.</p>}</article>)}
   {active.length>0&&<><h3>В работе и ожидают запуска</h3>{active.map(card)}</>}{recent.length>0&&<><h3>Последние результаты</h3>{recent.map(card)}</>}{!loading&&!jobs.length&&!pending.length&&<p>Заданий пока нет. Здесь появятся этапы импорта, анализа, создания голосов и озвучки.</p>}
  </div>
 </dialog>;
}
