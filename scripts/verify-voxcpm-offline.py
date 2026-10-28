"""Exclusive GPU probe with all Python network connections denied."""
import json, os, shutil, socket, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
try:
 with socket.create_connection(('127.0.0.1',8001),timeout=.5):
  raise SystemExit('Stop the project application before this exclusive GPU probe.')
except OSError:pass
os.environ.update(HF_HUB_OFFLINE='1',TRANSFORMERS_OFFLINE='1')
attempts=[]
def deny(*args,**kwargs):
 attempts.append(str(args[:1]));raise OSError('Network disabled by the offline verification')
socket.socket.connect=deny;socket.socket.connect_ex=deny
socket.create_connection=deny;socket.getaddrinfo=deny
sys.path.insert(0,str(ROOT/'services/ai'))
from runtime import execute
from model_registry import registry, VOX_SETTINGS, VOX_ADAPTER
target=ROOT/'outputs/voxcpm-v2';target.mkdir(parents=True,exist_ok=True)
gpu=json.loads((ROOT/'outputs/voxcpm/gpu.json').read_text(encoding='utf-8'))
reference=gpu['results']['reference']
result=execute({'kind':'speech','input':{'projectId':gpu['projectId'],'referenceKey':reference['fileKey'],'referenceText':'Этот мир изменился навсегда. Но наша история продолжается, и мы должны узнать правду.','canonical':{'spokenText':'Мир изменился, но мы продолжаем нашу историю.','synthesisText':'Мир изменился, но мы продолжаем нашу историю.','textPreparationVersion':'ru-caps-v1','cloningMode':'reference-only','language':'Russian','modelId':registry['speech']['id'],'modelRevision':registry['speech']['revision'],'adapterVersion':VOX_ADAPTER,'settings':VOX_SETTINGS|{'seed':42}}}})
assert not attempts,attempts
assert result['sourceSampleRate']==48000 and result['sampleRate']==24000
shutil.copyfile(ROOT/'storage/private'/result['fileKey'],target/'offline.wav')
(target/'offline.json').write_text(json.dumps({'passed':True,'networkAttempts':attempts,'scope':'All Python socket connections and DNS resolution denied before importing the adapter/SDK; physical host network remained connected.','result':result},indent=2),encoding='utf-8')
print('Offline VoxCPM inference passed without any network attempt.')
