import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
registry=json.loads((Path(__file__).parent/'models.json').read_text(encoding='utf-8'))
VOX_SETTINGS={'cfg_value':2.0,'inference_timesteps':10,'min_len':2,'max_len':4096,'normalize':False,'denoise':False,'retry_badcase':True,'retry_badcase_max_times':2,'retry_badcase_ratio_threshold':6.0}
VOX_ADAPTER='voxcpm2-v2'

def selected_model(kind,values):
 if kind not in ['design','speech']:return 'vision' if kind=='voice_prompt' else kind
 metadata=values.get('canonical',{}) if kind=='speech' else values
 revision=metadata.get('modelRevision')
 key=kind if revision==registry[kind]['revision'] else 'legacy_'+kind
 model=registry[key]
 if revision and revision!=model['revision']:raise ValueError('Unsupported speech model revision')
 if metadata.get('modelId',model['id'])!=model['id']:raise ValueError('Speech model ID/revision mismatch')
 if key==kind and metadata.get('adapterVersion') not in ['voxcpm2-v1',VOX_ADAPTER]:raise ValueError('Unsupported VoxCPM adapter version')
 if key!=kind and metadata.get('adapterVersion') is not None:raise ValueError('Unsupported legacy speech adapter version')
 return key

def vox_settings(values):
 settings=values.get('settings',values.get('generationSettings',{}))
 seed=settings.get('seed')
 if type(seed) is not int or not 0<=seed<2**31:raise ValueError('VoxCPM seed missing or invalid')
 if settings!={**VOX_SETTINGS,'seed':seed}:raise ValueError('Unsupported VoxCPM generation settings')
 return dict(settings)
