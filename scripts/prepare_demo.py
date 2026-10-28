import json, shutil, uuid, importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('runtime',ROOT/'services/ai/runtime.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
report=json.loads((ROOT/'outputs/gpu-smoke/report.json').read_text(encoding='utf-8'))
target=ROOT/'storage/demo';target.mkdir(parents=True,exist_ok=True)
project,chapter,page,voice=[str(uuid.uuid4()) for _ in range(4)]
us=[];segments=[];artifacts=[];files=[]
for i,text in enumerate(['Привет! Начнём историю.','Я готов идти дальше.']):
 aid,uid=str(uuid.uuid4()),str(uuid.uuid4());audio=report[f'speech-{i+1}'];key=f'{project}/speech-{i+1}.wav';shutil.copyfile(ROOT/'storage/private'/audio['fileKey'],target/f'speech-{i+1}.wav');files.append(key)
 bbox={'x':.375 if i==0 else .0875,'y':.09 if i==0 else .59,'width':.55,'height':.12}
 u={'id':uid,'pageId':page,'bbox':bbox,'order':i,'panelId':None,'kind':'dialogue','originalText':text,'spokenText':text,'characterId':None,'voiceVersionId':voice,'pauseMs':300,'included':True,'reviewStatus':'reviewed','revision':0};us.append(u)
 segments.append({'utteranceId':uid,'pageId':page,'panelId':None,'bbox':bbox,'text':text,'character':None,'audioArtifactId':aid,'fileKey':audio['fileKey'],'pauseMs':300});artifacts.append({'id':aid,'utteranceId':uid,'fileKey':key,'duration':audio['duration']})
audio=r.render({'projectId':project,'chapterId':chapter,'inputRevision':0,'segments':segments});renderKey=f'{project}/chapter.wav';shutil.copyfile(ROOT/'storage/private'/audio['fileKey'],target/'chapter.wav');files.append(renderKey)
imageKey=f'{project}/page.png';shutil.copyfile(ROOT/'work/fixtures/chapter-1.png',target/'page.png');files.append(imageKey)
import zipfile
zipKey=f'{project}/chapter.zip';files.append(zipKey)
with zipfile.ZipFile(target/'chapter.zip','w') as z:
 z.writestr('manifest.json',json.dumps(audio['manifest'],ensure_ascii=False));z.write(target/'speech-1.wav','utterances/1.wav');z.write(target/'speech-2.wav','utterances/2.wav')
p={'id':page,'chapterId':chapter,'projectId':project,'name':'Собственная тестовая страница','order':0,'width':800,'height':1000,'revision':0,'imageKey':imageKey,'previewKey':imageKey,'panels':[],'utterances':us}
c={'id':chapter,'title':'Демонстрационная глава','projectId':project,'revision':0,'order':0,'pages':[p],'renders':[{'id':str(uuid.uuid4()),'inputRevision':0,'fileKey':renderKey,'manifest':audio['manifest']|{'zipKey':zipKey}}]}
data={'project':{'id':project,'title':'Первые шаги','textLanguage':'ru','speechLanguage':'Russian','readingDirection':'ltr','revision':0,'chapters':[c],'characters':[],'voices':[]},'chapter':c,'pages':[p],'artifacts':artifacts,'files':files}
(target/'demo.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('Isolated demo prepared:',target)
