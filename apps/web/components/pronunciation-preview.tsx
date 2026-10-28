'use client';
import { useQuery } from '@tanstack/react-query';
import { pronunciationPreviewSchema } from '@mvs/contracts';
import { api } from '../lib/api';
export function PronunciationPreview({id,text,revision,dirty,demo}:{id:string;text:string;revision?:number;dirty:boolean;demo:boolean}){
 const preview=useQuery({queryKey:['pronunciation',id,text,revision],queryFn:async()=>pronunciationPreviewSchema.parse(await api('/utterances/'+id+'/pronunciation')),enabled:!dirty&&!demo&&revision!==undefined,retry:false});
 const current=preview.data?.spokenText===text&&preview.data?.utteranceRevision===revision;
 return <details open><summary>Текст для синтеза</summary>{demo?<p className="status">Подготовка текста недоступна в демо.</p>:dirty||revision===undefined?<p className="status">Предпросмотр обновится после сохранения реплики.</p>:preview.isError?<p className="error">{preview.error.message}</p>:!current?<p className="status">Подготовка текста…</p>:<><p aria-label="Подготовленный текст">{preview.data!.synthesisText}</p>{preview.data!.warnings.map(w=><p className="status" key={w}>{w}</p>)}<p className="status">Это текст, который получит модель. Для ручной коррекции измените «Произносимый текст». Исходный текст страницы сохраняется.</p></>}</details>;
}
