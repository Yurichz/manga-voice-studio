'use client';
import { useState,useEffect } from 'react';
import { Button } from './button';
import { api } from '../lib/api';
export function ProjectSettings({project,chapter,disabled,act}:{project:any;chapter:any;disabled:boolean;act:(fn:()=>Promise<unknown>)=>Promise<void>}){
 const [textLanguage,setText]=useState('en'),[speechLanguage,setSpeech]=useState('English');
 useEffect(()=>{if(project){setText(project.textLanguage);setSpeech(project.speechLanguage);}},[project?.id]);
 if(!project)return null;
 return <details><summary>Languages and chapter direction</summary><label>Text language<input disabled={disabled} value={textLanguage} onChange={e=>setText(e.target.value)}/></label><label>Speech language<select aria-label="Speech language" disabled={disabled} value={speechLanguage} onChange={e=>setSpeech(e.target.value)}>{['Russian','English','Chinese','Japanese','Korean','German','French','Portuguese','Spanish','Italian'].map(x=><option key={x}>{x}</option>)}</select></label><Button disabled={disabled} variant="secondary" onClick={()=>void act(()=>api('/projects/'+project.id,'PATCH',{title:project.title,textLanguage,speechLanguage,readingDirection:project.readingDirection,expectedRevision:project.revision}))}>Save languages</Button><p className="status">Reading direction and languages are independent. Text is not translated automatically.</p>{chapter&&<label>Chapter reading direction<select disabled={disabled} value={chapter.readingDirection||''} onChange={e=>void act(()=>api('/chapters/'+chapter.id,'PATCH',{expectedRevision:chapter.revision,readingDirection:e.target.value||null}))}><option value="">Use project setting</option><option value="rtl">Right to left</option><option value="ltr">Left to right</option></select></label>}</details>;
}
