'use client';
import { useQuery } from '@tanstack/react-query';
import { pronunciationPreviewSchema } from '@mvs/contracts';
import { api } from '../lib/api';
export function PronunciationPreview({id,text,revision,dirty,demo}:{id:string;text:string;revision?:number;dirty:boolean;demo:boolean}){
 const preview=useQuery({queryKey:['pronunciation',id,text,revision],queryFn:async()=>pronunciationPreviewSchema.parse(await api('/utterances/'+id+'/pronunciation')),enabled:!dirty&&!demo&&revision!==undefined,retry:false});
 const current=preview.data?.spokenText===text&&preview.data?.utteranceRevision===revision;
 return <details open><summary>Synthesis text</summary>{demo?<p className="status">Text preparation is unavailable in the demo.</p>:dirty||revision===undefined?<p className="status">The preview updates after the utterance is saved.</p>:preview.isError?<p className="error">{preview.error.message}</p>:!current?<p className="status">Preparing text…</p>:<><p aria-label='Prepared text'>{preview.data!.synthesisText}</p>{preview.data!.warnings.map(w=><p className="status" key={w}>{w}</p>)}<p className="status">This is the text sent to the model. Edit Spoken text to adjust pronunciation. The original page text is preserved.</p></>}</details>;
}
