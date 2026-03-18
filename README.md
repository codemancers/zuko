# Zuko

Zuko is an **agentic CRM** — a monorepo with a **Next.js web app** and **NestJS backend**, featuring contacts, deals, companies, and **AI chat** with context (e.g. attach contact, deal, or company to conversations). Built with Nx, Prisma, better-auth, and the AI SDK. Deployable to Fly.io; issue tracking lives in [Beads](.beads/) (`.beads/issues.jsonl`).

## Prerequisites

- **Node.js** 24 (matches CI)
- **bun**
- **PostgreSQL** (for the backend database)

## Setup

### 1. Clone the repository

If you haven't already, clone the repo and enter the project directory:

```sh
git clone <repository-url> zuko && cd zuko
```

### 2. Install dependencies

```sh
bun install
```

### 3. Environment variables

Copy the example env files and set values as needed:

- **Backend:** `apps/backend/.env.example` → `apps/backend/.env`
- **Web:** `apps/web/.env.example` → `apps/web/.env`

Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (backend) |
| `OPENAI_API_KEY` | Required for AI chat |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth (see example comments) |
| `BETTER_AUTH_*` | Auth config (see example files) |
| `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_BACKEND_URL` | App and API URLs (web) |

### 4. Database

Generate the Prisma client and run migrations:

```sh
# Generate Prisma client
bun nx run @zuko/models:prisma:generate

# Run migrations (creates/updates DB schema)
bun nx run @zuko/models:prisma:migrate -- --name init

# Optional: seed test data
bun nx run @zuko/models:seed
```

## Running the app

**Recommended — backend + web together:**

```sh
bun nx run @zuko/web:dev
```

This starts the NestJS backend (e.g. port 3001) and the Next.js app (e.g. port 3000).

**AI Agents only:**

```sh
bun nx run @zuko/ai-agents:dev
```

Starts the LangGraph-based agents service.

**Backend only:**

```sh
bun nx run @zuko/backend:serve
```

**Build (production):**

```sh
bun nx run @zuko/backend:build
bun nx run @zuko/web:build
bun nx run @zuko/ai-agents:build
```

## Tests

- **Unit tests:** `bun nx run @zuko/backend:test`, `bun nx run @zuko/web:test`  
  Or for affected projects: `bun nx affected -t test`
- **E2E (web):** `bun nx run @zuko/web-e2e:e2e`
- **Lint / typecheck:** `bun nx affected -t lint`, `bun nx affected -t typecheck`

## Project structure

| Path | Description |
|------|-------------|
| **Apps** | |
| `apps/backend` | NestJS API (auth, chat, sales: contacts/deals/companies) |
| `apps/web` | Next.js frontend |
| `apps/ai-agents` | LangGraph-based AI agents service |
| `apps/backend-e2e` | Backend E2E tests |
| `apps/web-e2e` | Web E2E tests (Playwright) |
| `apps/ai-agents-e2e` | AI agents E2E tests |
| **Libs** | |
| `libs/agents` | AI agent orchestration and tools |
| `libs/core` | Shared core utilities |
| `libs/models` | Prisma schema and client |
| `libs/sales` | CRM domain (contacts, deals, companies) |
| `libs/ui-kit` | Shared UI components |
| `.beads/` | Beads issue-tracking system |

## Documentation

- **[E2E tests](apps/web-e2e/README.md)** — How to run and write Playwright E2E tests for the web app.
- **[Beads](.beads/README.md)** — Issue tracking (CLI, sync with git).
- **Guides (e.g. Mintlify):** Planned; see the issue tracker for progress.

## Nx

This workspace is powered by [Nx](https://nx.dev). Useful commands:

- **Explore project graph:** `bun nx graph`
- **List targets for a project:** `bun nx show project @zuko/backend` (or `@zuko/web`)
- **Run tasks:** Use `bun nx run <project>:<target>` — e.g. `@zuko/backend`, `@zuko/web`, `@zuko/models`. [Nx run tasks](https://nx.dev/features/run-tasks).
- **IDE:** [Nx Console](https://nx.dev/getting-started/editor-setup) for VSCode/IntelliJ.

## License

MIT
