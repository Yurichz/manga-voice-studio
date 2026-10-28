'use client';
import { useState,useEffect } from 'react';
import { Button } from './button';
import { api } from '../lib/api';
export function ProjectSettings({project,chapter,disabled,act}:{project:any;chapter:any;disabled:boolean;act:(fn:()=>Promise<unknown>)=>Promise<void>}){
 const [textLanguage,setText]=useState('ru'),[speechLanguage,setSpeech]=useState('Russian');
 useEffect(()=>{if(project){setText(project.textLanguage);setSpeech(project.speechLanguage);}},[project?.id]);
 if(!project)return null;
 return <details><summary>Языки и направление главы</summary><label>Язык текста<input disabled={disabled} value={textLanguage} onChange={e=>setText(e.target.value)}/></label><label>Язык речи<select disabled={disabled} value={speechLanguage} onChange={e=>setSpeech(e.target.value)}>{['Russian','English','Chinese','Japanese','Korean','German','French','Portuguese','Spanish','Italian'].map(x=><option key={x}>{x}</option>)}</select></label><Button disabled={disabled} variant="secondary" onClick={()=>void act(()=>api('/projects/'+project.id,'PATCH',{title:project.title,textLanguage,speechLanguage,readingDirection:project.readingDirection,expectedRevision:project.revision}))}>Сохранить языки</Button><p className="status">Направление чтения и языки независимы. Автоматического перевода нет.</p>{chapter&&<label>Направление этой главы<select disabled={disabled} value={chapter.readingDirection||''} onChange={e=>void act(()=>api('/chapters/'+chapter.id,'PATCH',{expectedRevision:chapter.revision,readingDirection:e.target.value||null}))}><option value="">Как в проекте</option><option value="rtl">Справа налево</option><option value="ltr">Слева направо</option></select></label>}</details>;
}
