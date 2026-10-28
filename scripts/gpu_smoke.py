import json, os, uuid, time, shutil, sys
from pathlib import Path
import httpx
from fixtures import fixtures
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'services/ai'))
from model_registry import registry, VOX_SETTINGS, VOX_ADAPTER
metadata={'modelId':registry['speech']['id'],'modelRevision':registry['speech']['revision'],'adapterVersion':VOX_ADAPTER}
for line in (ROOT/'.env').read_text(encoding='utf-8-sig').splitlines():
 if '=' in line and not line.startswith('#'):k,v=line.split('=',1);os.environ[k]=v
project=str(uuid.uuid4());storage=ROOT/'storage/private';prefix=storage/project;prefix.mkdir(parents=True,exist_ok=True)
shutil.copyfile(fixtures()/'chapter-1.png',prefix/'page.png')
client=httpx.Client(base_url='http://127.0.0.1:8001',headers={'X-AI-Secret':os.environ['AI_SECRET']},timeout=920)
target=ROOT/'outputs/gpu-smoke';target.mkdir(parents=True,exist_ok=True);results={}
if '--resume' in sys.argv and (target/'report.json').exists():
 results=json.loads((target/'report.json').read_text(encoding='utf-8'));project=results['design']['fileKey'].split('/')[0]
 if results['design'].get('modelRevision')!=metadata['modelRevision'] or results['design'].get('adapterVersion')!=VOX_ADAPTER:raise SystemExit('Saved smoke report uses another speech model. Run without --resume.')
def run(name,kind,data):
 if name in results:return results[name]
 start=time.monotonic();r=client.post('/run',json={'jobId':str(uuid.uuid4()),'kind':kind,'input':data});r.raise_for_status();v=r.json();results[name]=v;print(name,round(time.monotonic()-start,2),'seconds',flush=True);(target/'report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');return v
reference_text='Сегодня начинается новая история. Я готов идти вперёд, даже если путь окажется непростым.'
prepared=run('voice_prompt','voice_prompt',{'description':'A warm calm adult male voice, natural clear Russian pronunciation, medium pitch.'})
voice=run('design','design',{**metadata,**prepared,'generationSettings':VOX_SETTINGS|{'seed':42},'projectId':project,'transcript':reference_text,'language':'Russian','description':'A warm calm adult male voice, natural clear Russian pronunciation, medium pitch.'})
for i,text in enumerate(['Привет! Начнём историю.','Я готов идти дальше.']):
 speech=run('speech-'+str(i+1),'speech',{'projectId':project,'referenceKey':voice['fileKey'],'referenceText':reference_text,'canonical':{**metadata,'settings':VOX_SETTINGS|{'seed':42},'spokenText':text,'synthesisText':text,'textPreparationVersion':'ru-caps-v1','cloningMode':'reference-only','language':'Russian'}})
 shutil.copyfile(storage/speech['fileKey'],target/f'speech-{i+1}.wav')
shutil.copyfile(storage/voice['fileKey'],target/'reference.wav')
run('vision','vision',{'projectId':project,'imageKey':project+'/page.png','readingDirection':'ltr'})
run('embedding','embedding',{'imageKey':project+'/page.png','bbox':{'x':.1,'y':.2,'width':.2,'height':.25}})
print('Real GPU smoke completed:',target,flush=True)
