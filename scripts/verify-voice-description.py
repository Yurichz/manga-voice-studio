"""Real, isolated comparison. No user voice is selected or overwritten."""
import json, os, uuid, shutil, time, concurrent.futures
from pathlib import Path
import httpx
ROOT=Path(__file__).resolve().parents[1]
for line in (ROOT/'.env').read_text(encoding='utf-8-sig').splitlines():
 if '=' in line and not line.startswith('#'):
  k,v=line.split('=',1);os.environ[k]=v
target=ROOT/'outputs/voice-description/default-settings';target.mkdir(parents=True,exist_ok=True)
report_path=target/'comparison.json'
report=json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else {'projectId':str(uuid.uuid4()),'samples':{},'failures':{},'listeningAssessment':'pending'}
description='Глубокий взрослый мужской голос рассказчика. Низкий, спокойный и мрачный тембр, уверенная размеренная речь. Атмосфера тёмного фэнтези и трагической хроники. Говорит серьёзно, без переигрывания, с небольшими драматическими паузами. Голос должен звучать масштабно и зловеще, как рассказ о катастрофе, которая изменила весь мир.'
transcript='Сегодня начинается новая история. Я готов идти вперёд, даже если путь окажется непростым.'
def save():report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
def run(kind,data):
 job=str(uuid.uuid4());token=str(uuid.uuid4());phases=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
  future=pool.submit(httpx.post,'http://127.0.0.1:8001/run',headers={'X-AI-Secret':os.environ['AI_SECRET']},json={'jobId':job,'attemptToken':token,'kind':kind,'input':data},timeout=910)
  while not future.done():
   time.sleep(1)
   r=httpx.get(f'http://127.0.0.1:8001/progress/{job}',params={'attemptToken':token},headers={'X-AI-Secret':os.environ['AI_SECRET']},timeout=5)
   p=r.json().get('progress')
   if p and (not phases or p['phase']!=phases[-1]['phase']):phases.append(p)
  response=future.result()
  if response.status_code>=400:raise RuntimeError(str(response.json().get('detail')))
  return response.json(),phases
if 'prepared' not in report:
 report['prepared'],report['preparationPhases']=run('voice_prompt',{'description':description});save();print('Prepared voice instruction:',report['prepared']['effectiveInstruction'],flush=True)
instructions={'original':description,'english':'Deep adult male narrator voice. A low, calm and somber timbre with confident, measured speech. The atmosphere of dark fantasy and a tragic chronicle. Serious delivery without overacting, with small dramatic pauses. The voice should sound grand and ominous, like an account of a catastrophe that changed the entire world.','concise':'Adult male narrator, deep low register, calm dark timbre. Confident, slow measured speech, serious restrained delivery with small dramatic pauses. Ominous dark-fantasy chronicle narration.','prepared':report['prepared']['effectiveInstruction']}
report.update(description=description,transcript=transcript,instructions=instructions)
for seed in [2026,4242]:
 for name,instruction in instructions.items():
  key=f'{name}-{seed}'
  if key in report['samples'] or key in report['failures']:continue
  try:result,phases=run('design',{'projectId':report['projectId'],'description':instruction,'transcript':transcript,'language':'Russian','seed':seed})
  except RuntimeError as error:
   report['failures'][key]=str(error);save();print(key,'FAILED:',error,flush=True);continue
  output=target/(key+'.wav');shutil.copyfile(ROOT/'storage/private'/result['fileKey'],output)
  report['samples'][key]={'result':result,'phases':phases,'path':str(output),'listeningAssessment':'pending'};save();print(key,'complete',round(result['duration'],1),'seconds',flush=True)
print('Comparison complete:',target,flush=True)
