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

## AI development workflow

Use the [Ponytail skill](.agents/skills/ponytail/SKILL.md) in **full** mode by default
for development work, including reviews, configuration, and tests. Read the skill
before starting. The user can change its level or turn it off.

The [Caveman skill](.agents/skills/caveman/SKILL.md) is available on request with
`/caveman`. Keep normal communication and existing model choices by default.
Installing the skill does not enable its voice or install CLI hooks.

Use [Vercel React Best Practices](.agents/skills/vercel-react-best-practices/SKILL.md)
when writing, reviewing, or refactoring React and Next.js code.

Use [Vercel Composition Patterns](.agents/skills/vercel-composition-patterns/SKILL.md)
when designing or reviewing React component APIs and composition.

[Agent Browser](.agents/skills/agent-browser/SKILL.md) is available for browser
automation and UI verification.

Use [NestJS Best Practices](.agents/skills/nestjs-best-practices/SKILL.md) when
writing, reviewing, or refactoring NestJS code, following this repository's invariants.

Use the [Eve skill](.agents/skills/eve/SKILL.md) when working on Eve agents and
harness configuration.

[Find Skills](.agents/skills/find-skills/SKILL.md) is available for discovering
skills when the user requests additional capabilities.

The [Better Auth skills](.agents/skills/better-auth-best-practices/SKILL.md) cover
auth configuration, scaffolding, security, email/password, organizations, and 2FA.
Use the relevant skill for auth work and preserve this repository's tenant scopes
and `BACKEND_URL` invariant.

Skills are managed by [skills.sh](https://skills.sh) under `.agents/skills/`,
with Claude Code symlinks under `.claude/skills/`. `skills-lock.json` records their
source commits and hashes. Upstream licenses are preserved as `.agents/ponytail.LICENSE`
and `.agents/caveman.LICENSE` outside the directories replaced by the installer.

Install or update only these skills for Codex and Claude Code:

```sh
npx skills add DietrichGebert/ponytail --skill ponytail -a codex claude-code -y
npx skills add juliusbrussee/caveman --skill caveman -a codex claude-code -y
npx skills add vercel-labs/agent-skills --skill vercel-react-best-practices -a codex claude-code -y
npx skills add vercel-labs/agent-skills --skill vercel-composition-patterns -a codex claude-code -y
npx skills add https://github.com/vercel-labs/agent-browser --skill agent-browser -a codex claude-code -y
npx skills add kadajett/agent-nestjs-skills --skill nestjs-best-practices -a codex claude-code -y
npx skills add vercel/eve --skill eve -a codex claude-code -y
npx skills add vercel-labs/skills --skill find-skills -a codex claude-code -y
npx skills add better-auth/skills --skill '*' -a codex claude-code -y
npx skills update -p -y
```

Review skill changes and the lockfile before committing updates.

### Optional local output compression

Follow the [Caveman progress note](README.md#ai-development-tooling): expand use
only when measured savings preserve useful diagnostic detail. The separate
Caveman CLI 4.2.0 can be installed outside the project with
`npm install -g @caveman-ai/cli@4.2.0`, followed by `caveman setup --install`.

- Analyze local history with `caveman learn --plain --sources codex,claude --repo zuko`.
  Treat findings as estimates; review proposed fixes before applying them.
- Use `caveman shrink -- <command> [args...]` selectively for noisy, finite checks.
  Run small checks, streaming servers, and interactive commands directly.
- Recover full output with `caveman retrieve <handle>` before diagnosing an unclear
  failure. Preserve errors, exit codes, and diagnostic details.
- Keep local reports under ignored `tmp/caveman/`; keep binaries and session
  history out of Git. If Caveman is unavailable, run the original command.
- Only report savings measured on the task. No agent hooks, proxies, or model
  routing are required for this standalone workflow.
