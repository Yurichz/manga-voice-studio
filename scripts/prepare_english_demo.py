"""Build the isolated English demo with real local Qwen/VoxCPM2 inference.

Run with .runtime/ai/Scripts/python.exe after installing the pinned model runtimes.
The report is resumable; --regenerate starts a new synthetic voice and audio set.
No user database, Redis queue, credentials or private storage are used.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import time
import uuid
import zipfile
from datetime import datetime, timezone

import httpx
import soundfile as sf

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'services/ai'))
from model_registry import registry, VOX_ADAPTER, VOX_SETTINGS
from speech_text import prepare_speech_text

IMAGE = ROOT / 'docs/assets/demo-manga.png'
REFERENCE = 'A new story begins today. I am ready to move forward, even when the journey is difficult.'
DESCRIPTION = 'A clear expressive adult male voice, medium-low register, warm timbre, natural English pronunciation.'
LINES = [
    ('Tyan, why are you always dragging us into this stuff?', 1, (.805, .045, .165, .36)),
    ('Why are you always so unreliable?', 1, (.513, .210, .155, .30)),
    ("Zeon... On second thought, I'm not asking! I'm telling you to find her!", 0, (.027, .065, .182, .405)),
    ("Teen! It's bad omen! Don't pull that again, you raccoon!", 2, (.030, .55, .190, .36)),
]
PANEL_BOXES = [(.025, .031, .50, .47), (.496, .031, .48, .47), (.025, .522, .95, .45)]
METADATA = {'modelId': registry['speech']['id'], 'modelRevision': registry['speech']['revision'], 'adapterVersion': VOX_ADAPTER}
SETTINGS = VOX_SETTINGS | {'seed': 42}


def box(values):
    return dict(zip(('x', 'y', 'width', 'height'), values))


def identifier():
    return str(uuid.uuid4())


def build_demo(target, report, staging):
    project, chapter, page, profile, voice = (report['ids'][key] for key in ('project', 'chapter', 'page', 'profile', 'voice'))
    panels = [{'id': value, 'bbox': box(bounds), 'order': [1, 0, 2][i], 'source': 'manual'}
              for i, (value, bounds) in enumerate(zip(report['ids']['panels'], PANEL_BOXES))]
    utterances, artifacts, segments, files = [], [], [], []
    target.mkdir(parents=True, exist_ok=True)

    def copy(source, name):
        shutil.copyfile(source, target / name)
        key = f'{project}/{name}'
        files.append(key)
        return key

    image_key = copy(IMAGE, 'demo-manga.png')
    reference_key = copy(staging / report['results']['design']['fileKey'], 'reference.wav')
    now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    for i, (text, panel, bounds) in enumerate(LINES):
        result = report['results'][f'speech-{i + 1}']
        key = copy(staging / result['fileKey'], f'speech-{i + 1}.wav')
        uid, aid = report['ids']['utterances'][i], report['ids']['artifacts'][i]
        utterances.append({'id': uid, 'pageId': page, 'projectId': project, 'panelId': panels[panel]['id'],
                           'bbox': box(bounds), 'order': i, 'kind': 'dialogue', 'originalText': text, 'spokenText': text,
                           'characterId': None, 'voiceVersionId': voice, 'pauseMs': 350, 'included': True,
                           'reviewStatus': 'reviewed', 'revision': 0, 'activeAudioId': aid})
        canonical = report['canonical'][i]
        artifacts.append({'id': aid, 'utteranceId': uid, 'fileKey': key, 'duration': result['duration'], 'createdAt': now,
                          'sampleRate': result['sampleRate'], 'sampleCount': result['sampleCount'],
                          'snapshot': {'canonical': canonical}})
        segments.append({'utteranceId': uid, 'pageId': page, 'panelId': panels[panel]['id'], 'bbox': box(bounds),
                         'text': text, 'character': None, 'audioArtifactId': aid, 'fileKey': result['fileKey'], 'pauseMs': 350})
    return project, chapter, page, profile, voice, panels, utterances, artifacts, segments, files, image_key, reference_key, now, copy


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--regenerate', action='store_true', help='Generate a new voice instead of resuming cached results')
    args = parser.parse_args()
    target = ROOT / 'storage/demo-english'
    work = ROOT / 'work/english-demo'
    staging = work / 'storage'
    work.mkdir(parents=True, exist_ok=True)
    staging.mkdir(parents=True, exist_ok=True)
    report_file = ROOT / 'outputs/english-demo/report.json'
    report_file.parent.mkdir(parents=True, exist_ok=True)
    fingerprint = hashlib.sha256(json.dumps({'image': hashlib.sha256(IMAGE.read_bytes()).hexdigest(), 'lines': LINES,
                                           'reference': REFERENCE, 'description': DESCRIPTION, 'metadata': METADATA,
                                           'settings': SETTINGS, 'preparation': prepare_speech_text('', 'English')['textPreparationVersion']},
                                          sort_keys=True).encode()).hexdigest()
    if report_file.exists() and not args.regenerate:
        report = json.loads(report_file.read_text(encoding='utf-8'))
        if report['fingerprint'] != fingerprint:
            raise SystemExit('Demo inputs changed. Run with --regenerate to create matching audio.')
        for result in report['results'].values():
            if result.get('fileKey') and not (staging / result['fileKey']).is_file():
                raise SystemExit('A cached audio file is missing. Run with --regenerate.')
            if result.get('fileKey') and hashlib.sha256((staging / result['fileKey']).read_bytes()).hexdigest() != result['checksum']:
                raise SystemExit('A cached audio checksum differs. Run with --regenerate.')
    else:
        report = {'fingerprint': fingerprint, 'ids': {key: identifier() for key in ('project', 'chapter', 'page', 'profile', 'voice')},
                  'results': {}, 'canonical': [], 'createdAt': datetime.now(timezone.utc).isoformat()}
        for key, count in [('panels', 3), ('utterances', 4), ('artifacts', 4)]:
            report['ids'][key] = [identifier() for _ in range(count)]

    def save():
        report_file.write_text(json.dumps(report, indent=2), encoding='utf-8')

    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        port = listener.getsockname()[1]
    secret = secrets.token_hex(32)
    environment = dict(os.environ, AI_SECRET=secret, STORAGE_ROOT=str(staging), PYTHONUNBUFFERED='1')
    python = ROOT / '.runtime/ai/Scripts/python.exe'
    active_job = None
    with (work / 'supervisor.log').open('w', encoding='utf-8') as log, httpx.Client(
            base_url=f'http://127.0.0.1:{port}', headers={'X-AI-Secret': secret}, timeout=920) as client:
        process = subprocess.Popen([str(python), '-m', 'uvicorn', 'services.ai.supervisor:app', '--host', '127.0.0.1', '--port', str(port)],
                                   cwd=ROOT, env=environment, stdout=log, stderr=log,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        try:
            for _ in range(120):
                if process.poll() is not None:
                    raise RuntimeError('The demo supervisor exited; see work/english-demo/supervisor.log')
                try:
                    if client.get('/health', timeout=1).is_success:
                        break
                except httpx.RequestError:
                    pass
                time.sleep(.5)
            else:
                raise RuntimeError('The isolated demo supervisor did not become ready')

            def run(name, kind, values):
                nonlocal active_job
                if name in report['results']:
                    print(f'{name}: using verified cached result', flush=True)
                    return report['results'][name]
                active_job = identifier()
                start = time.monotonic()
                response = client.post('/run', json={'jobId': active_job, 'kind': kind, 'input': values})
                if not response.is_success:
                    raise RuntimeError(f'{name}: {response.status_code} {response.text[:600]}')
                active_job = None
                result = response.json()
                if result.get('fileKey'):
                    samples, rate = sf.read(staging / result['fileKey'])
                    assert rate == 24000 and len(samples) == result['sampleCount'] and abs(samples).max() > .001
                report['results'][name] = result
                save()
                print(f'{name}: completed real inference/render in {time.monotonic() - start:.1f}s', flush=True)
                return result

            prepared = run('voice_prompt', 'voice_prompt', {'description': DESCRIPTION})
            voice = run('design', 'design', METADATA | prepared | {'generationSettings': SETTINGS, 'projectId': report['ids']['project'],
                                                                  'transcript': REFERENCE, 'language': 'English', 'description': DESCRIPTION})
            report['canonical'] = []
            for i, (text, _, _) in enumerate(LINES):
                canonical = METADATA | {'settings': SETTINGS, 'spokenText': text, **prepare_speech_text(text, 'English'),
                                        'cloningMode': 'reference-only', 'language': 'English', 'voiceVersionId': report['ids']['voice'],
                                        'referenceChecksum': voice['checksum']}
                canonical.pop('warnings')
                report['canonical'].append(canonical)
                run(f'speech-{i + 1}', 'speech', {'projectId': report['ids']['project'], 'referenceKey': voice['fileKey'],
                                                'referenceText': REFERENCE, 'canonical': canonical})
            values = build_demo(target, report, staging)
            project, chapter, page, profile, voice_id, panels, utterances, artifacts, segments, files, image_key, reference_key, now, copy = values
            audio = run('render', 'render', {'projectId': project, 'chapterId': chapter, 'inputRevision': 0, 'segments': segments})
            render_key = copy(staging / audio['fileKey'], 'chapter.wav')
            zip_key = f'{project}/chapter.zip'
            manifest = audio['manifest'] | {'zipKey': zip_key}
            assert len(manifest['segments']) == 4 and manifest['totalSamples'] == audio['sampleCount']
            with zipfile.ZipFile(target / 'chapter.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
                archive.writestr('manifest.json', json.dumps(manifest, indent=2))
                archive.write(target / 'chapter.wav', 'chapter.wav')
                for i in range(4):
                    archive.write(target / f'speech-{i + 1}.wav', f'utterances/{i + 1}.wav')
            files.append(zip_key)
            p = {'id': page, 'chapterId': chapter, 'projectId': project, 'name': 'A heated exchange', 'order': 0, 'width': 1561,
                 'height': 1008, 'revision': 0, 'imageKey': image_key, 'previewKey': image_key, 'panels': panels, 'utterances': utterances}
            c = {'id': chapter, 'title': 'An unexpected quest', 'projectId': project, 'revision': 0, 'order': 0, 'pages': [p],
                 'renders': [{'id': identifier(), 'inputRevision': 0, 'fileKey': render_key, 'manifest': manifest}]}
            version = {'id': voice_id, 'profileId': profile, 'referenceKey': reference_key, 'transcript': REFERENCE,
                       'language': 'English', 'checksum': voice['checksum'], 'duration': voice['duration'], 'createdAt': now, **METADATA}
            data = {'project': {'id': project, 'title': 'An unexpected quest', 'textLanguage': 'en', 'speechLanguage': 'English',
                                'readingDirection': 'rtl', 'revision': 0, 'chapters': [c], 'characters': [],
                                'voices': [{'id': profile, 'name': 'English storyteller', 'versions': [version]}]},
                    'chapter': c, 'pages': [p], 'artifacts': artifacts, 'files': files}
            (target / 'demo.json').write_text(json.dumps(data, indent=2), encoding='utf-8')
            report['completedAt'] = now
            report['target'] = str(target.relative_to(ROOT))
            save()
            print(f'English demo ready: {target}; four real English utterances, {audio["duration"]:.2f}s', flush=True)
        finally:
            if active_job:
                try:
                    client.post(f'/cancel/{active_job}', timeout=15)
                except httpx.RequestError:
                    pass
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == '__main__':
    main()
