"""Real supervised VoxCPM checks. Run --after-restart after restarting the app."""
import json, os, shutil, sys, time, uuid
from pathlib import Path
import httpx
import soundfile as sf

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'services/ai'))
from model_registry import registry, VOX_SETTINGS, VOX_ADAPTER
for line in (ROOT/'.env').read_text(encoding='utf-8-sig').splitlines():
 if '=' in line and not line.startswith('#'):
  key,value=line.split('=',1);os.environ[key]=value
target=ROOT/'outputs/voxcpm-v2';target.mkdir(parents=True,exist_ok=True)
report_path=target/'gpu.json'
report=json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else {'projectId':str(uuid.uuid4()),'results':{},'listeningAssessment':'pending'}
project=report['projectId'];storage=ROOT/'storage/private'
metadata={'modelId':registry['speech']['id'],'modelRevision':registry['speech']['revision'],'adapterVersion':VOX_ADAPTER}
client=httpx.Client(base_url='http://127.0.0.1:8001',headers={'X-AI-Secret':os.environ['AI_SECRET']},timeout=920)

def run(name,kind,values):
 if name in report['results']:return report['results'][name]
 started=time.monotonic()
 response=client.post('/run',json={'jobId':str(uuid.uuid4()),'kind':kind,'input':values})
 if not response.is_success:raise RuntimeError(response.text)
 result=response.json();report['results'][name]=result
 if 'fileKey' in result:
  shutil.copyfile(storage/result['fileKey'],target/(name+'.wav'))
  info=sf.info(storage/result['fileKey']);source=sf.info(storage/result['sourceKey'])
  assert info.samplerate==24000 and info.frames==result['sampleCount']
  assert source.samplerate==48000 and source.frames==result['sourceSampleCount']
  assert abs(info.duration-source.duration)<1/24000
  assert result['modelId']==metadata['modelId'] and result['modelRevision']==metadata['modelRevision']
  shutil.copyfile(storage/result['sourceKey'],target/(name+'-48k.wav'))
 report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(name,round(time.monotonic()-started,2),'seconds',flush=True)
 return result

description='Глубокий взрослый мужской голос рассказчика. Низкий, спокойный и мрачный тембр, уверенная размеренная речь. Атмосфера тёмного фэнтези и трагической хроники. Говорит серьёзно, без переигрывания, с небольшими драматическими паузами. Голос должен звучать масштабно и зловеще, как рассказ о катастрофе, которая изменила весь мир.'
transcript='Этот мир изменился навсегда. Но наша история продолжается, и мы должны узнать правду.'
if '--after-restart' not in sys.argv:
 prepared=run('prepared','voice_prompt',{'description':description})
 voice=run('reference','design',{'projectId':project,'description':description,'transcript':transcript,'language':'Russian',**prepared,**metadata,'generationSettings':VOX_SETTINGS|{'seed':2026}})
 for i,text in enumerate(['Катастрофа оставила лишь пепел и тишину.','Мы продолжим путь, даже если надежды больше нет.']):
  run('new-profile-'+str(i+1),'speech',{'projectId':project,'referenceKey':voice['fileKey'],'referenceText':transcript,'canonical':{**metadata,'settings':VOX_SETTINGS|{'seed':42},'spokenText':text,'synthesisText':text,'textPreparationVersion':'ru-caps-v1','cloningMode':'reference-only','language':'Russian'}})
 original=ROOT/'outputs/voice-description/default-settings/prepared-2026.wav'
 reference=storage/project/'accepted-qwen.wav';reference.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(original,reference)
 comparison=json.loads((original.parent/'comparison.json').read_text(encoding='utf-8'))
 old_transcript=comparison['transcript']
 run('existing-profile','speech',{'projectId':project,'referenceKey':project+'/accepted-qwen.wav','referenceText':old_transcript,'canonical':{**metadata,'settings':VOX_SETTINGS|{'seed':42},'spokenText':'Этот голос хранит память о погибшем мире.','synthesisText':'Этот голос хранит память о погибшем мире.','textPreparationVersion':'ru-caps-v1','cloningMode':'reference-only','language':'Russian'}})
else:
 voice=report['results']['reference']
 run('after-restart','speech',{'projectId':project,'referenceKey':voice['fileKey'],'referenceText':transcript,'canonical':{**metadata,'settings':VOX_SETTINGS|{'seed':42},'spokenText':'После долгой ночи история продолжается.','synthesisText':'После долгой ночи история продолжается.','textPreparationVersion':'ru-caps-v1','cloningMode':'reference-only','language':'Russian'}})
print('VoxCPM supervised verification:',report_path,flush=True)
