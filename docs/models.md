# Local models and runtimes

The executable registry is [../services/ai/models.json](../services/ai/models.json). Models are downloaded separately into `models/` with a revision marker; their weights and generated media are not distributed in Git.

| Purpose | Repository | Revision |
| --- | --- | --- |
| Page analysis / acoustic instruction preparation | Qwen/Qwen3-VL-4B-Instruct | ebb281ec70b05090aa6165b016eac8ec08e71b17 |
| Voice design / reusable speech | openbmb/VoxCPM2 | 32279effe8c19989596f05d353d1447f51d9e915 |
| Character-reference embeddings | google/siglip2-base-patch16-224 | 75de2d55ec2d0b4efc50b3e9ad70dba96a7b2fa2 |
| Optional legacy voice design | Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign | 5ecdb67327fd37bb2e042aab12ff7391903235d3 |
| Optional legacy synthesis | Qwen/Qwen3-TTS-12Hz-1.7B-Base | fd4b254389122332181a7c3db7f27e918eec64e3 |

Current weights total 15,337,242,656 bytes, excluding optional legacy checkpoints. Both VoxCPM operations share one directory/checkpoint. The downloader checks disk space with an additional margin. Python/runtime versions are pinned in the requirements lockfiles; the verified interpreter is Python 3.12.13.

## Voice design and synthesis

Qwen3-VL first converts the description to an English acoustic instruction; it does not translate the speech transcript. The supervisor releases that process before VoxCPM2 voice design. Save a generated reference only after listening. Imported references require a WAV, an exact transcript and confirmation of rights.

Current `voxcpm2-v2` synthesis uses the reference channel without audio continuation. Settings and a seed are recorded in immutable snapshots. The pinned VoxCPM SDK is 2.0.3; the adapter seeds Python/NumPy/PyTorch for each chunk instead of assuming the SDK accepts a seed argument. A seed is provenance, not a promise of bitwise reproducibility.

Native VoxCPM output is retained at 48 kHz; working WAV and chapter timelines use PCM at 24 kHz. The runtime checks nonempty, finite audio and sample counts. Default generation settings and current adapter/preparation identities are defined in the contracts and model registry code.

## Russian preparation

The authenticated CPU `/prepare-speech` endpoint is the shared implementation used by previews, speech and render snapshots. `ru-numbers-v1` normalizes fully uppercase Cyrillic and expands supported Russian numbers/year contexts. Ambiguous dates/codes/ranges/abbreviations remain visible with warnings. Original OCR and stored reference transcripts remain unchanged. Manual pronunciation spelling passes through; automatic stress insertion is not enabled.

## Vision and matching

Qwen3-VL native corner boxes on 0..1000 are converted to normalized regions with validation. Reversed/outside/invalid boxes and invalid text fields are rejected; proposals still require user review. SigLIP produces versioned 768-dimensional normalized embeddings on CPU. Exact pgvector cosine distance ranks confirmed references within one owner's project; it is not a recognition probability.

## Compatibility and limits

Old Qwen and VoxCPM snapshots retain their recorded inputs and routing. Unknown model/revision/adapter combinations fail visibly. Historical audio remains playable but does not satisfy a new current-model cache identity. There is no automatic replacement of voice versions or existing user recordings.

The verified GPU is RTX 4090 / 24 GB VRAM on Windows. Fresh model processes favor verifiable memory release over latency. Subjective voice quality, exact transcript fidelity and real-manga recognition accuracy require separate assessment.

See [../THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md), the linked upstream model cards and their notices for licenses.
