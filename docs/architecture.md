# Architecture

The repository is a pnpm TypeScript workspace with a local Python inference service. PostgreSQL is the source of truth; private files live on disk. The frontend proxies API calls to the loopback NestJS application.

## Components

| Path | Responsibility |
| --- | --- |
| apps/web | Next.js editor, SVG regions, local editor state, server queries and playback |
| apps/api | Nest controllers, HTTP validation/authentication and domain BL/CL modules |
| apps/worker | Nest application context, BullMQ processing, heartbeat/outbox/maintenance and job handlers |
| packages/backend | Shared DA repositories, transaction provider, ownership checks, enqueue/progress and coordinators |
| packages/database | Prisma schema, migrations and generated-client access |
| packages/contracts | Shared Zod contracts, audio identity and progress helpers |
| packages/storage | Atomic local files, archive validation and image normalization |
| packages/publication | Publication-format mapping, image/audio encoding and ZIP output |
| services/ai | Authenticated FastAPI supervisor and isolated local model adapters |

## Server layers

Controllers accept validated inputs and call BL services. BL implements business decisions and calls DA or CL. CL coordinates operations and transaction boundaries. DA owns Prisma model queries, parameterized SQL and persistence filters. Applications import shared backend modules instead of importing one another. See [nest-migration.md](nest-migration.md) for names, imports and compatibility choices.

Prisma transactions use AsyncLocalStorage. `$tx` opens a transaction; `$txe` reuses an explicit/active client or opens one. Repository transaction views do not mutate a singleton. Shutdown closes worker resources before the database connection.

## Request and job flow

1. Better Auth validates a cookie session. The API checks owner, browser Origin and request quota.
2. DTO schemas validate input; revision checks and project locks protect edits and job snapshots.
3. A database transaction records Job and OutboxEvent together. The outbox dispatcher delivers work to BullMQ.
4. The worker claims a job with an attempt token and publishes measured progress. Processing concurrency remains one.
5. The Python supervisor authenticates internal requests, serializes model operations and launches a fresh owned subprocess for inference.
6. The worker publishes results only after checking the attempt token, cancellation and project/page state inside a transaction.

Retries apply to transient failures. Missing models/runtimes block work until an explicit retry. Cancellation stops the owned model process, and stale heartbeats/attempts cannot overwrite current results.

## Snapshots, audio and files

Canonical audio identities include owner/project, text, pinned voice/reference checksum, model revision, adapter/settings and preparation version. Explicit variations carry their own seed/nonce. Current model/preparation checks keep old snapshots playable without selecting them as new current audio.

Canonical page coordinates are normalized to 0..1. Imports apply EXIF orientation, create previews and strip derivative metadata. Archive entries are read without arbitrary filesystem extraction. Files are written atomically and served only through authenticated project checks; original/staged files and publication caches are private.

Chapter rendering validates a consistent ordered snapshot and assembles existing 24 kHz PCM with sample-based cue positions. Publication export encodes that completed WAV to MP3 and validates the delivery contract; it does not synthesize speech again.

## Local model runtime

Vision and TTS have isolated Python environments to avoid dependency conflicts. A supervisor lock covers runtime creation, inference and process exit. Qwen3-VL prepares acoustic instructions before VoxCPM2 voice design; heavy processes exit between operations. SigLIP embeddings run on CPU. CPU text preparation remains available while GPU work is active. Model details are in [models.md](models.md).

The separate read-only demo loads whitelisted generated fixtures and does not import production database/queue/AI modules.
