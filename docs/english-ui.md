# English interface and demonstration

Implemented and verified on **2026-10-28**, using the Windows / RTX 4090 configuration documented in the README.

## Behavior

The editor, accessible controls, dialogs, jobs, validation messages, API/worker errors and speech-preparation warnings use English. The page declares `lang="en"`; dates and browser checks use `en-US`. No localization library or language switch was added. User text is never automatically translated.

New projects default to `textLanguage=en`, `speechLanguage=English` and independent `readingDirection=rtl`. The migration changes only PostgreSQL column defaults, with no updates to existing rows. PATCH accepts partial fields without creation defaults. A title-only edit of an existing Russian project retains its languages, direction, utterance/page/chapter revisions and selected audio. Stale revisions still return HTTP 409 with the existing error code.

The main [README](../README.md) is English; the redundant language-specific README was removed. Dependency versions, vendor contract, HTTP routes, status codes, response fields, old model adapters and text-preparation version identifiers are unchanged.

## Demo content and isolation

[The supplied illustration](assets/demo-manga.png) is copied unchanged, including its existing English dialogue. The three panels and four balloons are manually annotated, ordered right to left across the upper row and then through the bottom panel. The source artwork's wording is retained.

[scripts/prepare_english_demo.py](../scripts/prepare_english_demo.py) starts an isolated loopback AI supervisor with a temporary secret and separate staging files. It prepares an acoustic instruction with local Qwen3-VL, designs one English VoxCPM2 voice, synthesizes four utterances and renders their actual audio with 350 ms pauses. Inputs, model revisions, settings and file checksums identify resumable results. It closes its own supervisor on success or failure. It does not use the user database, Redis queue or private media directory.

The verified generated set contains:

| Audio | Duration | Output |
| --- | --- | --- |
| Synthetic voice reference | 5.60 s | 24 kHz PCM WAV |
| Four utterances | 3.52 / 2.40 / 4.48 / 4.16 s | 24 kHz PCM WAV |
| Chapter including pauses | 15.96 s / 383040 samples | WAV, four-segment sample-based timeline and ZIP |

The model is `openbmb/VoxCPM2` at revision `32279effe8c19989596f05d353d1447f51d9e915`, adapter `voxcpm2-v2`, seed 42. The speech-preparation version remains `ru-numbers-v1`; English text passes through unchanged. These durations describe the verified local generation, not a byte-for-byte reproducibility promise across hardware.

Generated data live in ignored `storage/demo-english`, separate from historical Russian fixtures in `storage/demo`. `DEMO_ROOT` selects the directory and defaults to the English set. Viewing uses only the file whitelist and read-only API; PostgreSQL, Redis and AI are disabled. Generated audio, voices and local reports are excluded from Git. The source illustration, generator and actual [editor screenshot](assets/editor-demo.png) are included. Artwork information is in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Verification

| Check | Result |
| --- | --- |
| Lint, TypeScript, architecture | Passed; 168 server files checked |
| Build | Prisma, shared packages, API, worker and Next.js passed |
| Publication contract | Version 1.0.0 and checksum passed |
| English demo publication | Real MP3/JSON export passed strict manifest validation; one chapter, three panels and four utterances |
| Unit tests | 19 passed; real integration remains opt-in |
| Python tests | 59 passed, including Russian regression inputs and English errors/warnings |
| Isolated integration | 21 passed; 8 GPU cases skipped in this run |
| Editor browser scenarios | 12 passed; 4 opt-in/separate-demo cases skipped |
| English demo browser scenarios | 2 passed with database/Redis disabled and empty auth/AI secrets |
| Real English inference | One new voice, four utterances and actual chapter render passed |
| Screenshot | Captured in an `en-US` browser while audio played; full supplied page, panels, selected utterance and highlighting reviewed |

Integration used disposable PostgreSQL/pgvector and Redis, separate storage and queue names, and the real supervisor. Coverage includes API/Prisma creation defaults, English authentication errors, revision conflicts, Russian title-only PATCH with current audio preserved, ownership, rollback, outbox redelivery, pronunciation, private Range downloads and actual publication encoding/export. Nest application contexts closed normally.

Browser checks cover manual annotation, conflict recovery across tabs, page deletion, job progress, Russian pronunciation and English project creation/reload. The demo checks validate all four transcripts, WAV headers, timeline sample positions, seeking, playback speed, advancing audio time, highlight state, file isolation and rejected imports/edits/generation. The generator's cached-resume path was also exercised.

The complete Russian GPU suite and launcher-driven restart browser cases were not rerun for this change. Their earlier **2026-10-28** results remain recorded in [implementation-plan.md](implementation-plan.md). The new real GPU run covers the English demonstration. No new OCR accuracy or perceptual speech-quality benchmark is claimed. No application deployment was performed.
