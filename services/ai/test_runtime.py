import importlib.util
from pathlib import Path
import numpy as np
import pytest
spec=importlib.util.spec_from_file_location('runtime',Path(__file__).parent/'runtime.py')
runtime=importlib.util.module_from_spec(spec);spec.loader.exec_module(runtime)
def test_chunks_preserve_unicode_and_bound_length():
 text='Привет! '+('Очень длинная реплика. '*90)
 parts=runtime.chunks(text)
 assert all(0<len(x)<=500 for x in parts)
 assert ''.join(parts).replace(' ','')==text.replace(' ','')
def test_resample_uses_sample_count():
 data=np.ones(48000,dtype=np.float32)
 assert len(runtime.normalize_audio(data,48000))==24000
def test_storage_traversal_is_rejected():
 with pytest.raises(ValueError):runtime.path_key('../../secret')
def test_geometry_output_is_validated():
 with pytest.raises(ValueError):runtime.validate_analysis({'panels':[{'bbox':{'x':.9,'y':0,'width':.5,'height':1}}],'utterances':[],'characters':[]})
def test_empty_audio_is_rejected():
 with pytest.raises(ValueError):runtime.write_audio(np.zeros(100),24000,'test')
def test_analysis_rejects_invalid_enum_not_only_geometry():
 with pytest.raises(ValueError):runtime.validate_analysis({'panels':[],'utterances':[{'bbox':{'x':0,'y':0,'width':.2,'height':.2},'order':0,'kind':'dialogue|thought','text':'text','needsReview':True}],'characters':[]})

def test_analysis_converts_native_qwen_corners_without_guessing_or_changing_text():
 import json
 source={'panels':[[100,200,900,1000]],'utterances':[{'bbox_2d':[500,210,890,390],'kind':'dialogue','text':'НЕ ДЁРГАЙСЯ.','needsReview':False}],'characters':[]}
 result=runtime.parse_analysis('```json\n'+json.dumps(source)+'\n```')
 assert result['panels'][0]=={'order':0,'bbox':{'x':.1,'y':.2,'width':.8,'height':.8}}
 assert result['utterances'][0]['text']=='НЕ ДЁРГАЙСЯ.'
 assert result['utterances'][0]['needsReview'] is True and result['utterances'][0]['order']==0
 assert result['utterances'][0]['bbox']=={'x':.5,'y':.21,'width':.39,'height':.18}
 assert 'bbox_2d' not in result['utterances'][0]

@pytest.mark.parametrize('box',[[100,200,90,300],[-1,0,100,100],[0,0,1001,100],[0,0,0,100],[True,0,100,100],[0,0,float('nan'),100],[0,0,100],{'x':0,'y':0,'width':.1,'height':.1}])
def test_analysis_rejects_invalid_native_geometry_instead_of_clipping(box):
 import json
 with pytest.raises(ValueError,match=r'panels\[0\].bbox_2d'):
  runtime.parse_analysis(json.dumps({'panels':[{'bbox_2d':box,'order':0}],'utterances':[],'characters':[]}))

def test_analysis_rejects_truncation_and_reports_the_schema_location():
 import json
 with pytest.raises(ValueError):runtime.parse_analysis('{"panels":[')
 with pytest.raises(ValueError,match=r'utterances\[0\]: invalid utterance schema'):
  runtime.parse_analysis(json.dumps({'panels':[],'utterances':[{'bbox_2d':[10,20,100,200],'kind':'unknown','text':'Текст'}],'characters':[]}))
def test_render_manifest_uses_samples_and_pauses(tmp_path,monkeypatch):
 import soundfile as sf
 monkeypatch.setattr(runtime,'STORAGE',tmp_path)
 samples=np.sin(np.arange(4800)*.05).astype(np.float32)
 sf.write(tmp_path/'a.wav',samples[:2400],24000);sf.write(tmp_path/'b.wav',samples,24000)
 base={'pageId':'page','panelId':None,'bbox':{'x':0,'y':0,'width':.2,'height':.2},'text':'test','character':None}
 result=runtime.render({'projectId':'project','chapterId':'chapter','inputRevision':3,'segments':[base|{'utteranceId':'a','audioArtifactId':'a','fileKey':'a.wav','pauseMs':50},base|{'utteranceId':'b','audioArtifactId':'b','fileKey':'b.wav','pauseMs':100}]})
 assert result['manifest']['totalSamples']==10800
 assert result['manifest']['segments'][0]['endSample']==2400
 assert result['manifest']['segments'][1]['startSample']==3600
 assert sf.info(tmp_path/result['fileKey']).frames==10800

def test_progress_sidecar_is_atomic_and_measured(tmp_path,monkeypatch):
 import json
 path=tmp_path/'progress.json';monkeypatch.setattr(runtime,'PROGRESS_PATH',path)
 runtime.report('generating',1,3,'chunks');data=json.loads(path.read_text())
 assert data['completed']==1 and data['total']==3 and data['phase']=='generating'
 assert not path.with_suffix('.tmp').exists()
 with pytest.raises(ValueError):runtime.report('generating',4,3,'chunks')
 assert json.loads(path.read_text())==data

def test_design_keeps_transcript_and_uses_prepared_instruction():
 class Model:
  def generate_voice_design(self,**kwargs):return kwargs
 provider=object.__new__(runtime.QwenSpeechProvider);provider.model=Model()
 result=provider.design({'transcript':'Русский текст.','language':'Russian','description':'Исходное описание','effectiveInstruction':'Adult male, deep low register.'})
 assert result['text']=='Русский текст.' and result['language']=='Russian'
 assert result['instruct']=='Adult male, deep low register.' and 'speaker' not in result
 with pytest.raises(ValueError):runtime.validate_voice_instruction('Русский ответ')
 with pytest.raises(ValueError):runtime.validate_voice_instruction('Young female soprano.','Взрослый мужской низкий голос.')
 assert runtime.validate_voice_instruction('Adult male, low register.','Взрослый мужской низкий голос.')=='Adult male, low register.'

def test_progress_recovers_from_windows_reader_handle(tmp_path,monkeypatch):
 import json
 path=tmp_path/'progress.json';monkeypatch.setattr(runtime,'PROGRESS_PATH',path)
 replace=runtime.os.replace;calls=[]
 def temporarily_locked(source,target):
  calls.append(1)
  if len(calls)<3:raise PermissionError('sharing violation')
  replace(source,target)
 monkeypatch.setattr(runtime.os,'replace',temporarily_locked);monkeypatch.setattr(runtime.time,'sleep',lambda _seconds:None)
 runtime.report('writing_audio');assert json.loads(path.read_text())['phase']=='writing_audio' and len(calls)==3

def test_vox_design_prefix_and_cloning_keep_canonical_text(tmp_path,monkeypatch):
 from model_registry import VOX_SETTINGS
 from types import SimpleNamespace
 seeds=[];monkeypatch.setitem(runtime.sys.modules,'torch',SimpleNamespace(manual_seed=seeds.append,cuda=SimpleNamespace(manual_seed_all=lambda _seed:None)))
 calls=[]
 class Model:
  def generate(self,**kwargs):calls.append(kwargs);return np.ones(100,dtype=np.float32)
 provider=object.__new__(runtime.VoxSpeechProvider);provider.model=Model();provider.rate=48000
 settings=VOX_SETTINGS|{'seed':42}
 provider.design({'description':'Низкий мужской голос.','effectiveInstruction':'Adult male, low register.','transcript':'Точный русский текст.','generationSettings':settings})
 assert calls[0]['text']=='(Adult male, low register.) Точный русский текст.'
 assert seeds==[42] and 'seed' not in calls[0]
 assert not calls[0]['normalize'] and not calls[0]['denoise']
 monkeypatch.setattr(runtime,'STORAGE',tmp_path)
 provider.speech({'referenceKey':'ref.wav','referenceText':'Точный русский текст.','canonical':{'spokenText':'Новая реплика.','settings':settings}})
 clone=calls[1]
 assert clone['text']=='Новая реплика.' and clone['prompt_text']=='Точный русский текст.'
 assert clone['prompt_wav_path']==clone['reference_wav_path']==str(tmp_path/'ref.wav')
 assert 'instruct' not in clone
 from model_registry import VOX_ADAPTER
 canonical={'spokenText':'НОВАЯ РЕПЛИКА.','synthesisText':'Новая реплика.','textPreparationVersion':'ru-caps-v1','cloningMode':'reference-only','adapterVersion':VOX_ADAPTER,'settings':settings}
 provider.speech({'referenceKey':'ref.wav','referenceText':'Точный русский текст.','canonical':canonical})
 assert calls[2]['text']=='Новая реплика.' and canonical['spokenText']=='НОВАЯ РЕПЛИКА.'
 assert calls[2]['reference_wav_path']==str(tmp_path/'ref.wav')
 assert 'prompt_wav_path' not in calls[2] and 'prompt_text' not in calls[2] and 'instruct' not in calls[2]
 prepared=canonical|{'spokenText':'2016 год.','synthesisText':'Две тысячи шестнадцатый год.','textPreparationVersion':'ru-numbers-v1'}
 provider.speech({'referenceKey':'ref.wav','referenceText':'Точный русский текст.','canonical':prepared})
 assert calls[3]['text']=='Две тысячи шестнадцатый год.' and 'prompt_text' not in calls[3] and 'prompt_wav_path' not in calls[3]
 assert prepared['spokenText']=='2016 год.' and canonical['textPreparationVersion']=='ru-caps-v1'
 with pytest.raises(ValueError):provider.speech({'referenceKey':'ref.wav','referenceText':'Точный русский текст.','canonical':canonical|{'textPreparationVersion':'unknown'}})

def test_model_selection_respects_legacy_snapshots_and_rejects_mismatches():
 from model_registry import selected_model, registry, vox_settings, VOX_SETTINGS
 assert selected_model('design',{})=='legacy_design'
 assert selected_model('speech',{'canonical':{'modelRevision':registry['legacy_speech']['revision']}})=='legacy_speech'
 metadata={'modelId':registry['speech']['id'],'modelRevision':registry['speech']['revision'],'adapterVersion':'voxcpm2-v1'}
 assert selected_model('speech',{'canonical':metadata})=='speech'
 assert selected_model('speech',{'canonical':metadata|{'adapterVersion':'voxcpm2-v2'}})=='speech'
 with pytest.raises(ValueError):selected_model('speech',{'canonical':metadata|{'adapterVersion':'unknown'}})
 with pytest.raises(ValueError):selected_model('speech',{'canonical':metadata|{'modelId':'wrong'}})
 with pytest.raises(ValueError):selected_model('design',{'modelRevision':'unknown'})
 with pytest.raises(ValueError):selected_model('design',{'adapterVersion':'voxcpm2-v1'})
 with pytest.raises(ValueError):vox_settings({'settings':VOX_SETTINGS|{'seed':42,'denoise':True}})
 assert vox_settings({'settings':VOX_SETTINGS|{'seed':42}})['seed']==42
