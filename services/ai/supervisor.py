import asyncio, json, os, secrets, sys, time
from pathlib import Path
from typing import Literal
from fastapi import FastAPI, Header, HTTPException, Depends
from pydantic import BaseModel, Field
from services.ai.model_registry import registry, selected_model
from services.ai.speech_text import prepare_speech_text
ROOT=Path(__file__).resolve().parents[2]
app=FastAPI(title='Manga Voice Studio internal AI')
lock=asyncio.Lock()
active:dict={}
cancelled=set()
def available(kind):
 m=registry[kind];directory=ROOT/'models'/m['directory'];marker=directory/'.mvs-revision'
 files=m.get('requiredFiles',['config.json','speech_tokenizer/model.safetensors'] if kind.startswith('legacy_') else ['config.json'])
 return marker.is_file() and marker.read_text()==m['revision'] and all((directory/f).is_file() for f in files) and any(directory.glob('*.safetensors'))
def authorize(x_ai_secret:str=Header(default='')):
 expected=os.environ.get('AI_SECRET','')
 if not expected or not secrets.compare_digest(expected,x_ai_secret): raise HTTPException(401,'Internal authentication required')
class Task(BaseModel):
 jobId:str=Field(pattern=r'^[a-zA-Z0-9-]{1,100}$')
 kind:Literal['design','speech','vision','voice_prompt','embedding','voice_import','render']
 attemptToken:str=Field(default='',pattern=r'^[a-zA-Z0-9-]{0,100}$')
 input:dict
class SpeechTexts(BaseModel):
 texts:list[str]=Field(min_length=1,max_length=500)
 language:str=Field(min_length=2,max_length=30)

@app.post('/prepare-speech',dependencies=[Depends(authorize)])
def prepare_speech(values:SpeechTexts):
 try:return [prepare_speech_text(text,values.language) for text in values.texts]
 except ValueError as error:raise HTTPException(422,str(error))
@app.get('/health',dependencies=[Depends(authorize)])
async def health():
 return {'alive':True,'activeJob':active.get('jobId'),'models':{k:{'available':available(k),'runtimeInstalled':(ROOT/'.runtime'/m.get('runtime','vision')/'Scripts/python.exe').is_file(),'id':m['id'],'revision':m['revision'],'languages':['Chinese','Japanese','Korean','Burmese','Indonesian','Khmer','Lao','Malay','Tagalog','Thai','Vietnamese','Hindi','Danish','Dutch','English','Finnish','German','Norwegian','Swedish','French','Italian','Portuguese','Spanish','Greek','Polish','Russian','Turkish','Arabic','Hebrew','Swahili'] if k in ['design','speech'] else [],'instructionControl':k in ['design','speech'],'createVoice':k=='design','cloneVoice':k=='speech','legacy':m.get('legacy',False),'referenceSeconds':{'min':2,'max':30} if k in ['design','speech'] else None} for k,m in registry.items()}}
@app.post('/cancel/{job_id}',dependencies=[Depends(authorize)])
async def cancel(job_id:str):
 cancelled.add(job_id)
 proc=active.get('process') if active.get('jobId')==job_id else None
 if proc and proc.returncode is None:
  proc.kill();await proc.wait()
 return {'cancelled':True}
@app.post('/run',dependencies=[Depends(authorize)])
async def run(task:Task):
 try:model_kind=selected_model(task.kind,task.input)
 except ValueError as error:raise HTTPException(422,str(error))
 model=registry.get(model_kind)
 if model and not available(model_kind): raise HTTPException(503,'Model weights unavailable or revision differs: '+model['id'])
 async with lock:
  if task.jobId in cancelled: raise HTTPException(409,'Cancelled')
  runtime=model.get('runtime','vision') if model else 'ai'
  python=ROOT/'.runtime'/runtime/'Scripts/python.exe'
  if not python.exists(): raise HTTPException(503,'Runtime not installed: '+runtime)
  work=ROOT/'work/ai';work.mkdir(parents=True,exist_ok=True)
  token=secrets.token_hex(16);source=work/(token+'.input.json');target=work/(token+'.result.json')
  progress=work/(token+'.progress.json')
  source.write_text(json.dumps(task.model_dump()|{'progressPath':str(progress)},ensure_ascii=False),encoding='utf-8')
  env=dict(os.environ,HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1',HF_HOME=str(ROOT/'.cache/huggingface'),TOKENIZERS_PARALLELISM='false')
  start=time.monotonic()
  proc=await asyncio.create_subprocess_exec(str(python),str(Path(__file__).parent/'runtime.py'),str(source),str(target),cwd=ROOT,env=env,stdout=asyncio.subprocess.DEVNULL,stderr=asyncio.subprocess.DEVNULL)
  active.update(jobId=task.jobId,process=proc,kind=task.kind,attemptToken=task.attemptToken,progressPath=progress)
  try:
   try: await asyncio.wait_for(proc.wait(),timeout=900)
   except asyncio.TimeoutError: proc.kill();await proc.wait();raise HTTPException(504,'Inference timeout')
   if task.jobId in cancelled: raise HTTPException(409,'Cancelled')
   if not target.exists(): raise HTTPException(500,f'Runtime exited without result (exit code {proc.returncode})')
   result=json.loads(target.read_text(encoding='utf-8'))
   if 'error' in result: raise HTTPException(422,result['error'])
   result['elapsedSeconds']=time.monotonic()-start
   if progress.exists():result['runtimeProgress']=json.loads(progress.read_text(encoding='utf-8'))
   return result
  finally:
   if proc.returncode is None: proc.kill();await proc.wait()
   active.clear();cancelled.discard(task.jobId);source.unlink(missing_ok=True);target.unlink(missing_ok=True);progress.unlink(missing_ok=True);progress.with_suffix('.tmp').unlink(missing_ok=True)

@app.get('/progress/{job_id}',dependencies=[Depends(authorize)])
async def job_progress(job_id:str,attemptToken:str):
 if active.get('jobId')!=job_id or active.get('attemptToken')!=attemptToken:return {'progress':None}
 try:return {'progress':json.loads(active['progressPath'].read_text(encoding='utf-8'))}
 except (FileNotFoundError,PermissionError,json.JSONDecodeError):return {'progress':None}
