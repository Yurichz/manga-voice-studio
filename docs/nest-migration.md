# NestJS migration — 2026-10-28

The API now uses Nest controllers and constructor injection. The worker is a separate Nest application context. Existing HTTP payloads, Better Auth cookies, Zod validation, database schema, queue inputs and model snapshots are retained.

## Code boundaries

- `apps/api/src/core/app` contains the production bootstrap, root module and BL module registry. Each HTTP domain has its own controller, BL service, DTOs and BL module under `core/routes/<domain>`. Transactional operations that coordinate entities live in a feature CL module.
- `packages/backend/src/core/routes` contains shared, named DA repositories and DA modules, ownership services, job enqueue/progress services and snapshot/deletion/publication coordinators. Controllers never import repositories. Model queries and parameterized SQL stay in DA.
- `packages/backend/src/core/providers` contains Prisma, Better Auth and the internal AI client. Filesystem/image/archive operations reuse the existing storage and publication packages.
- `apps/worker/src/core/routes/jobs` contains nine handlers, processor/outbox/runtime BL services, render-snapshot and publication CL services. BullMQ still uses the existing queue name, one concurrent job, attempt fencing, priorities and retry policy. Maintenance runs do not overlap.

`PrismaService.$tx` opens a transaction and rejects nested `$tx`; `$txe` reuses an explicit or active transaction. Repository views returned by `tx(client)` do not change singleton state. Database shutdown runs after worker module destruction so pending work closes before the client disconnects.

## Intentional differences from the full Kelly skill

- Better Auth sessions and bootstrap-only registration replace the skill's JWT/Auth/Users/CASL stack. Ownership checks still apply to concrete resources.
- Existing raw JSON responses, string error codes, endpoint paths and status codes are retained. There is no new `success/data` envelope or pagination contract.
- Zod schemas remain the validation source. Nest pipes and OpenAPI share these schemas. Response entities describe the existing public shapes without changing their serialization.
- OpenAPI reads metadata on registered Nest controller methods. It does not inspect an Express router. The existing `@nestjs/swagger` 11 package has Nest 11 peers while this repository uses Nest 12; the migration does not invoke that incompatible scanner or change either pinned version.
- DA is shared by the two applications rather than duplicated inside each app. Feature modules explicitly import their DA/CL dependencies.
- Existing NodeNext/CommonJS compilation is retained. Relative runtime imports use `.js`; no repository-wide ESM conversion is required.

## Build and launch

`pnpm build:server` compiles the server workspace and stages JavaScript in each shared package's ignored `dist` directory. Package exports select that JavaScript by default. The `mvs-source` condition selects TypeScript for `tsx` development and verification scripts.

- `pnpm dev:api`, `pnpm dev:worker`: source execution with explicit injection tokens.
- `pnpm dev:web`: builds server/shared packages before starting the unchanged frontend.
- `pnpm build`: Prisma generation, server/shared build, then Next.js production build.
- `pnpm start:api`, `pnpm start:worker`: plain Node.js execution of the compiled applications.
- `studio.cmd start`: builds server/shared packages and starts the existing local application. Services bind to loopback. `API_PORT` defaults to 3001; frontend proxy defaults remain unchanged.

Prisma CLI and client are both pinned to 6.19.0 in the database workspace. This also makes Prisma's generator resolve its CLI/client consistently with pnpm workspace links. No schema migration was added.

The demo entrypoint branches before importing the production application. Its file whitelist and refusal of writes remain independent of PostgreSQL, Redis and AI.

## Verification

- `pnpm lint`, `pnpm typecheck`, `pnpm check:architecture`, `pnpm test`, `pnpm build`.
- `pnpm test:server:integration`: builds the server, starts disposable PostgreSQL/pgvector and Redis containers, applies existing migrations, starts the real CPU AI supervisor and both compiled Nest applications, then runs integration tests.
- `pnpm test:server:gpu`: the same isolated environment with existing real local models enabled.
- `node scripts/verify-nest-migration.mjs --browser --only-browser`: runs the existing Playwright suite against isolated services and the built Next.js application on ports 3000/3001. Those ports must be free. Full restart/GPU browser scenarios remain disabled in this harness.

The verification harness requires an already installed/running Docker engine, the project's AI Python environment and existing model assets. Set `MVS_DOCKER` if Docker CLI discovery needs an explicit path. It never uses the owner's database, Redis instance or private storage. Logs and reports live under `work/nest-verification/<run>/`. Temporary containers are removed, and Nest applications receive a normal `app.close()` before their dependencies stop. Sign-in test sets run separately to respect Better Auth's existing authentication limits.

The architecture checker covers direct layer dependencies, provider registration, model/SQL placement, cross-application imports and static runtime import cycles. Behavioral and PostgreSQL tests are still required; the checker does not prove every runtime dependency or business invariant.

The migration preserves existing user data and model snapshots. Verification reports and local source backups are excluded from the public repository.
