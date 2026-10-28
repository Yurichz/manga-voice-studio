'use client';
import { useState } from 'react';
import { api } from '../lib/api';
import { Button } from './button';
export function VoiceImport({projectId,disabled,act}:{projectId:string;disabled:boolean;act:(fn:()=>Promise<unknown>)=>Promise<void>}){
 const [name,setName]=useState(''),[transcript,setTranscript]=useState(''),[rights,setRights]=useState(false),[file,setFile]=useState<File|null>(null);
 return <details><summary>Import a voice WAV</summary><form onSubmit={e=>{e.preventDefault();if(!file||!rights)return;void act(async()=>{const form=new FormData();form.append('file',file);await api('/projects/'+projectId+'/voices/import','POST',form,{'X-Voice-Name':encodeURIComponent(name),'X-Transcript':encodeURIComponent(transcript),'X-Rights-Confirmed':'true'});setFile(null);setRights(false);});}}><label>Voice name<input required disabled={disabled} value={name} onChange={e=>setName(e.target.value)}/></label><label>WAV, 2–30 seconds<input required disabled={disabled} type="file" accept=".wav" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><label>Exact transcript<textarea required disabled={disabled} value={transcript} onChange={e=>setTranscript(e.target.value)}/></label><label className="check"><input disabled={disabled} type="checkbox" checked={rights} onChange={e=>setRights(e.target.checked)}/>I have permission to use this voice and recording</label><Button disabled={disabled||!rights||!file} type="submit">Import</Button></form></details>;
}
