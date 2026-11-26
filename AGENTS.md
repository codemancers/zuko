# Zuko

Nx + pnpm monorepo: `apps/backend` (NestJS, Prisma 7, Postgres), `apps/app` (Next.js), `libs/*` (access-control, better-auth hierarchy and audit plugins), e2e in `apps/backend-e2e`. UI conventions are in `apps/app/AGENTS.md`.

## Working

- **One branch per effort, one commit per feature.** Don't push, open or merge a PR unless asked.
- **Libs come from generators** (`nx g @nx/js:library`, then `nx sync`). No new lib unless asked.
- **Migrations:** an unmerged one may be edited in place, but prefer a new additive migration when a dev DB holds data. Dump before rebuilding a database.
- **Verify for real:** run the backend (:3000) and app (:4200), hit the real endpoints and drive the UI. Build and unit tests alone aren't enough. The backend doesn't watch: rebuild and restart it after changes, and before `nx e2e @zuko/backend-e2e` (which uses the running server).

## Invariants

- **Multi-tenant:** every table has `organizationId` and row-level security; query through `withTenant`. Ids are autoincrement BigInt (strings in the API).
- **Auth origin is `BACKEND_URL`** (issuer, audience, JWKS), not `BETTER_AUTH_URL`.
- **Runtime dependencies go in both the root and the app `package.json`,** or production deploys break.
- **Permissions:** capabilities come from `libs/access-control`; which records a person may touch comes from role scopes (own, own and reports, team, all). Changing what a record links to or shows follows the same scopes.

## Tests

- DB-backed tests need their own `TEST_DATABASE_URL` (see `.env.example`), never the dev database.
- Clean up only rows your test created (scoped by a per-run suffix): specs run in parallel on one server and database.

## Agent skills

Use the smallest relevant skill for the task; the curated list and update commands
are in [README.md](README.md#ai-development-tooling). Read supporting references
only as needed. Repository rules and existing patterns take precedence over
examples in third-party skills.

- Explore projects and dependencies with `nx-workspace`; use `nx-generate` before
  scaffolding and `nx-run-tasks` for task selection. Prefix Nx commands with `pnpm`.
- Use `agent-browser` for interactive UI checks and the existing TypeScript
  Playwright suite for repeatable browser tests.
- Preserve tenant scopes, auth origins, validation, and accessibility when applying
  React, NestJS, Better Auth, or Eve guidance.

All project skills are managed by skills.sh under `.agents/skills/`, with Claude
Code links in `.claude/skills/` and pinned sources in `skills-lock.json`. Nx MCP is
configured directly for both agents. Keep installs explicit; the broad Nx plugin
and `nx configure-ai-agents` regenerate workflows deliberately excluded here.
