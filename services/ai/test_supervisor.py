import asyncio,json,importlib.util
from pathlib import Path
import httpx
spec=importlib.util.spec_from_file_location('supervisor',Path(__file__).parent/'supervisor.py');supervisor=importlib.util.module_from_spec(spec);spec.loader.exec_module(supervisor)

def test_speech_preparation_is_authenticated_bounded_and_works_during_gpu_lock(monkeypatch):
 monkeypatch.setenv('AI_SECRET','test-secret')
 async def check():
  supervisor.lock=asyncio.Lock()
  async with supervisor.lock:
   async with httpx.AsyncClient(transport=httpx.ASGITransport(app=supervisor.app),base_url='http://test') as client:
    body={'texts':['2016 год','В 7 раз'],'language':'Russian'}
    assert (await client.post('/prepare-speech',json=body)).status_code==401
    headers={'X-AI-Secret':'test-secret'}
    response=await client.post('/prepare-speech',headers=headers,json=body)
    assert response.status_code==200 and [p['synthesisText'] for p in response.json()]==['Две тысячи шестнадцатый год','В семь раз']
    assert (await client.post('/prepare-speech',headers=headers,json={'texts':['7'*10001],'language':'Russian'})).status_code==422
    assert (await client.post('/prepare-speech',headers=headers,json={'texts':[],'language':'Russian'})).status_code==422
 asyncio.run(check())
def test_authentication_and_single_runtime_lock(monkeypatch):
 monkeypatch.setenv('AI_SECRET','test-secret')
 monkeypatch.setattr(supervisor,'available',lambda _kind:True)
 state={'running':0,'peak':0}
 class Process:
  returncode=None
  def __init__(self,target):self.target=target;state['running']+=1;state['peak']=max(state['peak'],state['running'])
  async def wait(self):
   await asyncio.sleep(.02)
   if self.returncode is None:self.returncode=0;state['running']-=1;Path(self.target).write_text(json.dumps({'testOnly':True}))
   return self.returncode
  def kill(self):self.returncode=-9;state['running']-=1
 async def spawn(*args,**_kwargs):return Process(args[-1])
 monkeypatch.setattr(supervisor.asyncio,'create_subprocess_exec',spawn)
 async def check():
  supervisor.lock=asyncio.Lock()
  async with httpx.AsyncClient(transport=httpx.ASGITransport(app=supervisor.app),base_url='http://test') as client:
   assert (await client.get('/health')).status_code==401
   responses=await asyncio.gather(*[client.post('/run',headers={'X-AI-Secret':'test-secret'},json={'jobId':'unit-'+str(i),'kind':'speech','input':{}}) for i in range(2)])
   assert all(r.status_code==200 for r in responses)
   assert state['peak']==1 and state['running']==0
 asyncio.run(check())

def test_progress_is_internal_and_fenced_by_attempt(tmp_path,monkeypatch):
 monkeypatch.setenv('AI_SECRET','test-secret')
 p=tmp_path/'p.json';p.write_text(json.dumps({'phase':'generating'}));supervisor.active.update(jobId='job',attemptToken='new',progressPath=p)
 async def check():
  async with httpx.AsyncClient(transport=httpx.ASGITransport(app=supervisor.app),base_url='http://test') as client:
   assert (await client.get('/progress/job?attemptToken=new')).status_code==401
   headers={'X-AI-Secret':'test-secret'}
   assert (await client.get('/progress/job?attemptToken=old',headers=headers)).json()=={'progress':None}
   assert (await client.get('/progress/job?attemptToken=new',headers=headers)).json()['progress']['phase']=='generating'
   p.unlink();assert (await client.get('/progress/job?attemptToken=new',headers=headers)).json()=={'progress':None}
 try:asyncio.run(check())
 finally:supervisor.active.clear()

def test_vox_availability_requires_audio_vae_and_all_tokenizer_assets(tmp_path,monkeypatch):
 monkeypatch.setattr(supervisor,'ROOT',tmp_path)
 model=supervisor.registry['speech'];directory=tmp_path/'models'/model['directory'];directory.mkdir(parents=True)
 (directory/'.mvs-revision').write_text(model['revision'])
 for name in model['requiredFiles']:(directory/name).write_bytes(b'explicit-test-fixture')
 assert supervisor.available('speech') and supervisor.available('design')
 (directory/'audiovae.pth').unlink()
 assert not supervisor.available('speech')
