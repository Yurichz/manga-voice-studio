# Publication export and reader integration

The editor exports an independent `.mvs-publication.zip` package. A reader may import that package without the editor's database, Redis or inference services. The reader itself is a separate application and is not included here.

## Readiness and snapshot

- `GET /api/v1/projects/:projectId/publication-preview` reports each chapter's readiness and blocking issues.
- `POST /api/v1/projects/:projectId/publication-export` accepts selected chapter IDs, description, credits and an optional cover page; an idempotency key is required.
- Included utterances must be reviewed, have a pinned voice and current matching audio, and belong to a completed current chapter render.
- The API captures a RepeatableRead snapshot. Later edits do not enter the queued package; the job exposes a snapshot notice.
- The worker validates/encodes existing images and WAV, writes a completed package and exposes its private download only after successful fenced publication.

Legacy WAV/ZIP output is retained. Publication export performs FFmpeg MP3 encoding without another TTS run. MP3 duration is validated against the rendered timeline before cues are emitted in delivered-audio milliseconds.

## Contract and identity

The pinned contract is `@mvs/publication-format` 1.0.0. Its installable artifact is in `vendor/`; [../vendor/publication-contract.json](../vendor/publication-contract.json) records the checksum. Run `pnpm contract:verify` to check it.

The package contains a manifest, chapter JSON, canonical page derivatives, one MP3 track per chapter and validated cues/content digests. Runtime voice references, user/session records, original private sources and alternate speech takes are not delivery assets.

A persistent per-project namespace is stored with private files. Preserve it together with database/file backups so repeat exports retain source identity. An independent copy needs its own namespace. Reader draft review/publication, reader access control and hosting are the responsibility of the consuming application.

## Verification

The 2026-10-28 migration checks exercised readiness, real render/MP3/ZIP encoding, manifest validation, private downloads and retention of a captured title after a later project edit. The publication-specific case used an explicit recorded-audio fixture; separate GPU integration cases exercised new speech generation.

Older isolated acceptance scripts under `scripts/*publication*` are advanced workflows requiring prepared local media/configuration. Review their prerequisites before use; [../CONTRIBUTING.md](../CONTRIBUTING.md) documents the primary isolated runner.
