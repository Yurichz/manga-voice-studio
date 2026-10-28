import json, os, sys, shutil
from pathlib import Path
from huggingface_hub import snapshot_download
ROOT=Path(__file__).resolve().parents[2]
os.environ['HF_HOME']=str(ROOT/'.cache/huggingface')
registry=json.loads((Path(__file__).parent/'models.json').read_text())
selected=sys.argv[1:] or [k for k,m in registry.items() if not m.get('legacy')]
models=list({(registry[x]['id'],registry[x]['revision']):registry[x] for x in selected}.values())
required=sum(m['weightBytes'] for m in models)
print(json.dumps({'directory':str(ROOT/'models'),'weightsBytes':required,'freeBytes':shutil.disk_usage(ROOT).free,'models':models},ensure_ascii=False),flush=True)
if shutil.disk_usage(ROOT).free<required*1.3+10*1024**3: raise SystemExit('Insufficient space including download margin')
for m in models:
 snapshot_download(repo_id=m['id'],revision=m['revision'],local_dir=ROOT/'models'/m['directory'],allow_patterns=m.get('requiredFiles',['*.json','*.safetensors','*.txt','*.model','*.npz','LICENSE*','README.md']),max_workers=4)
 (ROOT/'models'/m['directory']/'.mvs-revision').write_text(m['revision'])
 print('Downloaded '+m['id'],flush=True)
