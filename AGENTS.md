# Manga Voice Studio

Read docs/product.md and docs/architecture.md before changing behavior. Record completed checks and blockers in docs/implementation-plan.md.
Keep private files, models, virtual environments and caches inside this project; never modify another AI project or global Python/CUDA installations.
Use real local models in normal mode. Test adapters must be explicitly selected. Preserve ownership checks, snapshots and revision conflicts.
Bind services to loopback. Do not deploy services or publish user data. Repository publication requires explicit user authorization. Do not commit secrets, user data or model weights.
Run pnpm typecheck, pnpm test and relevant integration/GPU checks before reporting success.
Server changes follow the BL/DA/CL boundaries and scoped Kelly style documented in docs/nest-migration.md. Keep model queries and SQL in DA; import shared backend modules rather than another application.
Run pnpm check:architecture for server changes. Prefer pnpm test:server:integration or pnpm test:server:gpu so verification uses disposable services and separate storage.
