# Contributing

Use the pinned dependency versions and keep changes focused. The application is a Windows-first local editor; see [docs/setup.md](docs/setup.md) and [docs/architecture.md](docs/architecture.md).

## Server conventions

- Controller → BL → DA; CL coordinates domains and transaction boundaries. Model queries and SQL belong in DA.
- Import shared backend modules; applications must not import each other. Feature modules explicitly import their dependencies.
- Use 2 spaces, single quotes, semicolons, trailing commas and at most 150 characters per server-code line. The scoped EditorConfig/ESLint rules enforce this.
- Preserve owner scope, revision checks, immutable voice/job snapshots, attempt fencing and transaction semantics.
- Keep normal mode on real local models; any test adapter must be explicit. Do not replace inference with a silent cloud fallback.

## JavaScript checks without models

From a fresh source checkout, install dependencies and build before typechecking the generated Next.js route declarations:

```powershell
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm typecheck
pnpm check:architecture
pnpm test
pnpm contract:verify
```

Prisma generation requires a syntactically valid `DATABASE_URL`, but these checks do not query a database. Setup generates a real local config; CI uses test-only environment values. Ordinary tests skip real integration cases. On Windows stop running applications before regenerating the Prisma engine.

## Real integration and browser checks

Install the project's Python environments, have Docker running and download the local models. The integration runner uses disposable PostgreSQL/pgvector and Redis containers, a unique queue, separate files and the real supervisor. It never needs an owner's existing project data.

Prepare original drawing/speech fixtures with the normal AI supervisor running (`studio.cmd start`), then stop the normal app before isolated checks:

```powershell
.runtime\ai\Scripts\python.exe scripts/fixtures.py
.runtime\ai\Scripts\python.exe scripts/gpu_smoke.py
.runtime\ai\Scripts\python.exe scripts/prepare_demo.py
.\studio.cmd stop
```

Some historical voice regression cases expect `outputs/voice-description/default-settings/prepared-2026.wav`. For a fresh test setup, copy your generated smoke reference there **only if that fixture does not already exist**. It is an explicit synthetic test fixture, not an owner voice profile:

```powershell
$fixture = 'outputs/voice-description/default-settings/prepared-2026.wav'
if (!(Test-Path -LiteralPath $fixture)) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $fixture) | Out-Null
  Copy-Item -LiteralPath 'outputs/gpu-smoke/reference.wav' -Destination $fixture
}
pnpm test:server:integration
pnpm test:server:gpu
```

The CPU integration set still needs prepared media and an installed supervisor. The full GPU set also tests legacy Qwen compatibility, so explicitly download `legacy_design`/`legacy_speech` if those checkpoints are absent. They are not part of the default current-model download.

For browser regressions, build the frontend, install the matching Playwright browser and leave ports 3000/3001 free:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.cache/playwright'
pnpm exec playwright install chromium
pnpm build
node scripts/verify-nest-migration.mjs --browser --only-browser
```

Full launcher-driven restart tests are separately opt-in and must be run only against a dedicated test configuration. Local logs/media/reports belong in ignored `work/` or `outputs/`. Do not add user recordings, manga pages, secrets, model weights or environments to a PR.

## Pull requests

Explain the concrete behavior change and checks performed. Include API/schema compatibility impacts where relevant. Update documentation when commands or behavior change. Report unavailable hardware/integration checks as skipped, not passed.
