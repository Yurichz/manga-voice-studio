import type { Content } from './editor';
export type Draft={key:string;raw:string;content:Content;savedAt:number};
export function draftKey(pageId:string,writerId:string){return 'mvs-draft-'+pageId+'-'+writerId;}
export function latestDraft(pageId:string):Draft|null{
 const legacy='mvs-draft-'+pageId;let latest:Draft|null=null;
 for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i)!;if(key!==legacy&&!key.startsWith(legacy+'-'))continue;
  try{const raw=localStorage.getItem(key)!,value=JSON.parse(raw),content=value.content||value;
   if(!Array.isArray(content.panels)||!Array.isArray(content.utterances))continue;
   const savedAt=value.savedAt||0;if(!latest||savedAt>latest.savedAt)latest={key,raw,content,savedAt};
  }catch{/* A damaged draft must not prevent opening the server version. */}
 }
 return latest;
}
export function removeUnchangedDraft(draft:Draft){if(localStorage.getItem(draft.key)===draft.raw)localStorage.removeItem(draft.key);}
