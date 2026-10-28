# Product scope

Manga Voice Studio is a local editor for narrating manga and comics. One project represents a work; its chapters share character profiles and pinned voice versions. The initial interface and speech workflow target Russian.

## Main workflow

Import pages → create or review regions/text → assign speakers and voices → review utterances → generate speech → render a chapter → read with highlighting → export.

Manual correction is the primary workflow. AI analysis produces proposals rather than silently replacing annotations. Original OCR text and edited spoken text are distinct fields. Text language, speech language and reading direction are independent settings.

## Existing capabilities

- PNG/JPEG/WebP and ZIP/CBZ import with size/content checks, natural ordering, canonical images and previews.
- Manual page regions, panels and utterances; speaker assignment, ordering, pauses, inclusion and review state.
- Persistent project character references and similarity candidates requiring confirmation.
- Synthetic voice design, permitted WAV import and immutable voice versions.
- Utterance/batch synthesis, explicit takes, cache reuse, progress, cancellation and retry.
- Pronunciation preview using the same recorded text-preparation version as synthesis.
- Current chapter renders with sample-based timelines and synchronized playback.
- Private WAV/ZIP downloads and a separate publication package for an independent reader.

## Data rules

Owners cannot access another owner's resources. Revision-checked edits reject stale writes. Queued operations capture immutable inputs, and late/cancelled attempts cannot publish over current work. Voice versions and historical audio remain available; editing a line invalidates affected current output rather than rewriting history.

## Boundaries

No automatic translation, model training, video export, payments or cloud inference is included. AI geometry, transcription, reading order, speaker matching and voice quality require review. Similarity is not a calibrated recognition probability. There is no published accuracy benchmark on a licensed real-manga dataset.

Normal use is local and authenticated. Initial installation/downloads require network access. A production internet deployment, organization roles and a hosted public reader are separate work.
