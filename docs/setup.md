# Installation and operations

Commands below run from the cloned repository root in Windows PowerShell. Other platforms are not verified. The repository contains source, schema migrations, an installable publication-contract artifact and the supplied demonstration illustration. Model weights, recordings, user pages, credentials and local verification reports are not distributed.

## Prerequisites

- Git, Node.js 26.3.1 and pnpm 11.25.0.
- [uv](https://docs.astral.sh/uv/getting-started/installation/); setup installs Python 3.12.13 into project-managed environments.
- Docker Desktop with a working Linux engine/WSL2. Start it before launching the app.
- For inference: a compatible NVIDIA driver/CUDA-capable GPU. RTX 4090 / 24 GB VRAM is the verified configuration, not a minimum requirement.
- About 15.34 GB for current model weights plus space for environments, caches, Docker volumes and user data. Legacy Qwen checkpoints need additional space only if explicitly downloaded.

No paid inference API is required. Initial dependency/model installation uses the network; normal inference uses local weights.

## First installation

```powershell
git clone https://github.com/Yurichz/manga-voice-studio.git
Set-Location manga-voice-studio
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force
.\scripts\setup.ps1
.\scripts\download-models.ps1
.\studio.cmd start
pnpm bootstrap
```

Setup creates `.env` with random local secrets, installs the frozen pnpm dependencies, generates Prisma, builds server packages and installs the four isolated Python environments. It does not overwrite an existing `.env`. The default downloader selects Qwen3-VL, VoxCPM2 and SigLIP2; the design/speech checkpoint is downloaded once. Do not download the optional legacy models unless old snapshots require them.

The launcher starts PostgreSQL/Redis through Compose, applies the included migrations and starts API, worker, AI and the web editor. Bootstrap creates the first owner; credentials are in `.runtime/owner-credentials.txt`. Optional process variables `MVS_OWNER_EMAIL` and `MVS_OWNER_PASSWORD` customize that first owner. Public sign-up is disabled.

If Docker is absent, review its license and installation requirements first. `scripts/system-setup.ps1 -AcceptDockerLicense` is an explicit administrator installation option; it may require a Windows reboot. Existing Docker installations are reused.

## Local endpoints

| Service | Default |
| --- | --- |
| Editor | http://localhost:3000 |
| API | http://127.0.0.1:3001 |
| OpenAPI, authenticated | /api/v1/openapi |
| API liveness | /health/live |
| Internal AI | http://127.0.0.1:8001; requires internal secret |
| PostgreSQL | 127.0.0.1:54329 |
| Redis | 127.0.0.1:63799 |

Services bind to loopback. Exposing them to the internet requires a separate deployment/security design.

## Configuration

The field names and placeholder values are in [../.env.example](../.env.example). Do not commit the real file.

| Variable | Meaning |
| --- | --- |
| DATABASE_URL / POSTGRES_* | Prisma connection and local Compose database credentials |
| REDIS_URL | BullMQ transport connection |
| BETTER_AUTH_SECRET | Session/authentication secret generated locally |
| BETTER_AUTH_URL | Trusted browser origin; normally http://localhost:3000 |
| AI_SECRET / AI_URL | Internal supervisor authentication and address |
| API_PORT | API listening port; default 3001 |
| STORAGE_ROOT | Private local files; normally ./storage/private |
| MODEL_ROOT | Model location setting; the current registry/downloader uses the repository's models directory |
| DEMO_MODE | Enables the separate read-only demo entrypoint |
| DEMO_ROOT | Whitelisted demo directory; default ./storage/demo-english |

Changing API/AI ports also requires updating the corresponding frontend proxy or launcher settings; `API_PORT` alone does not reconfigure every service. Restart after changing environment values. Keep database and file backups together.

## Everyday commands

```powershell
.\studio.cmd start
.\studio.cmd diagnose
.\studio.cmd stop
```

Start/stop uses recorded PIDs and start times to manage owned processes. Stop the application before Prisma generation or dependency replacement on Windows: a running engine may hold its DLL open. PostgreSQL/Redis volumes persist after application shutdown.

## Backup and restore

Stop application writers while leaving PostgreSQL available. Choose a new directory **inside this project** for the private backup:

```powershell
.\scripts\backup.ps1 -Destination (Join-Path (Get-Location) 'outputs\backup-example')
```

The backup includes a database dump, private files and checksums, not model weights or secrets. Protect it as user data. Restore only to an existing empty database and a storage path that does not yet exist:

```powershell
.\scripts\restore.ps1 -Source '.\outputs\backup-example' -Database 'mvs_restore' -StorageDirectory 'storage\restored'
```

Create the empty target database separately. Do not apply application migrations before restoring the dump. After a successful restore, configure the application to use the restored database/storage and keep the original model revisions. [The publication guide](editor-integration-audit.md) explains why the namespace file must also be retained.

## Demo

The English demo uses only whitelisted files in `DEMO_ROOT` (default `storage/demo-english`) and refuses writes without connecting to private services. Its generated media are not part of the repository. Install the pinned current models/runtimes, then generate its synthetic voice, four utterances and sample-based chapter track:

```powershell
.runtime\ai\Scripts\python.exe scripts/prepare_english_demo.py
.\scripts\demo.ps1
```

Run `pnpm dev:web` in a second terminal. The generator starts and stops its own isolated AI supervisor, resumes verified cached results and never opens the user database or queue. `--regenerate` creates a new voice. Viewing the finished demo needs only the demo API and frontend. The historical Russian `storage/demo` fixtures are retained for regression tests.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| PowerShell refuses scripts | Use the process-scoped RemoteSigned command above; the launcher scopes its policy to its child process. |
| Docker/WSL2 is unavailable | Start Docker Desktop and wait for the Linux engine; inspect `docker context ls` and the installed Docker setup. |
| Port already occupied | Stop the previous owned instance with `studio.cmd stop`; inspect the reported port before stopping any other process. |
| Prisma DLL cannot be replaced | Stop API/worker, then rerun generation/build. |
| Cannot resolve a shared package's compiled entry | Run `pnpm build:server`; source execution needs `--conditions=mvs-source --import tsx`. |
| AI job is blocked | Check model revision markers, available disk space, local runtime installation and the visible error before retrying. |
| Request receives 403 | Check browser Origin and `BETTER_AUTH_URL`. |
| Edit receives 409 | Reload the saved version; the editor retains conflict drafts. |
| Login tests receive 429 | Respect the existing authentication rate limit; the isolated runner spaces its test sets. |

Runtime logs are in ignored `work/`. Review logs before sharing them: they can contain identifiers or operational details.
