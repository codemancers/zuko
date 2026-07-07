# @zuko/ai-agent

A standalone AI agent for Zuko, built on [eve](https://eve.dev) — Vercel's
filesystem-first agent framework. The agent manages contacts, companies, and
deals by calling the Zuko backend's `/api/agents/*` REST API, authenticated
with better-auth agent-auth JWTs.

## Layout

```
agent/
├── instructions.md   # system prompt
├── agent.ts          # model config (OpenAI gpt-4.1)
├── lib/
│   ├── env.ts            # env parsing
│   ├── credentials.ts    # agent keypair persistence
│   ├── zuko-client.ts    # registration, JWT signing, API fetch wrapper
│   └── editor-data.ts    # plain text → Editor.js wrapper for rich-text fields
└── tools/            # one file per tool; filename = tool name
```

## Prerequisites

- Node ≥ 24 (eve requirement); bun for installs.
- The Zuko backend running (default `http://localhost:3001`) with
  `BETTER_AUTH_SECRET` set and Postgres migrated.
- An OpenAI API key (`OPENAI_API_KEY`) — the agent uses gpt-4.1 directly.

## Setup

1. Provision a host identity (once per backend database):

   ```sh
   cd apps/backend && bun run provision:agent-host
   ```

2. Configure the agent:

   ```sh
   cp .env.example .env   # fill in OPENAI_API_KEY, ZUKO_ORG_ID,
                          # ZUKO_DEFAULT_OWNER_ID, and the ZUKO_HOST_* values
                          # printed by provision:agent-host
   ```

`ZUKO_BACKEND_URL` must exactly match the backend's `BACKEND_URL` — it is the
JWT audience; a mismatch fails auth.

**Warning:** `ZUKO_ORG_ID` selects the organization the agent operates in and
is trusted by the backend's agent routes. A wrong value silently targets the
wrong organization's CRM data.

## Development

```sh
bun nx run @zuko/ai-agent:dev        # from repo root
# or, guaranteed-interactive TUI:
cd apps/ai-agent && bunx eve dev
```

The TUI serves the agent on port 2000. On the first tool call the agent
registers itself with the backend (vouched by the provisioned host) and
stores its credentials in `.zuko/agent-credentials.json`.

## HTTP API

`eve start`/`eve dev` expose a session API:

```sh
# start a session
curl -i -X POST http://localhost:3002/eve/v1/session \
  -H 'content-type: application/json' \
  -d '{"message":"How many contacts do we have?"}'

# stream the response (NDJSON) using the x-eve-session-id response header
curl -N http://localhost:3002/eve/v1/session/<sessionId>/stream

# follow-up (continuationToken from the create response)
curl -X POST http://localhost:3002/eve/v1/session/<sessionId> \
  -H 'content-type: application/json' \
  -d '{"continuationToken":"<token>","message":"Create a deal for Acme."}'
```

## Registration model

The agent authenticates as a better-auth **autonomous agent**:

1. A host identity is provisioned once in the backend database
   (`bun run provision:agent-host` in apps/backend). Dynamic (thumbprint-
   issuer) host registration is not usable against Zuko — its agent-auth
   tables use serial integer ids, so the host JWT issuer must be the numeric
   host id.
2. On first use the agent generates its own keypair, signs a host JWT with
   the provisioned host key (embedding the agent's public key), and calls
   `POST ${ZUKO_BACKEND_URL}/auth/agent/register`.
3. Per API request it signs a fresh short-lived (60s, single-use — the
   backend enforces jti replay protection) agent JWT with its private key and
   calls `/api/agents/*` with `Authorization: Bearer` + `x-org-id`.

For production, register once and provision the credentials as env vars so
ephemeral containers don't re-register on every boot:

```sh
bun run register   # prints ZUKO_AGENT_ID / ZUKO_AGENT_PRIVATE_JWK / ZUKO_AGENT_PUBLIC_JWK
```

## Build & run (production)

```sh
bun nx run @zuko/ai-agent:build      # eve build
bun nx run @zuko/ai-agent:start      # eve start --port 3002
```

## Docker

Build from the repo root:

```sh
docker build -f apps/ai-agent/Dockerfile -t zuko-ai-agent .

docker run -p 3002:3002 \
  -v zuko-agent-data:/data \
  -e OPENAI_API_KEY=... \
  -e ZUKO_BACKEND_URL=http://host.docker.internal:3001 \
  -e ZUKO_ORG_ID=1 \
  -e ZUKO_DEFAULT_OWNER_ID=1 \
  zuko-ai-agent
```

Credentials persist in the `/data` volume; alternatively set
`ZUKO_AGENT_ID`/`ZUKO_AGENT_PRIVATE_JWK` and skip the volume. When testing
against a local backend, the backend must be started with
`BACKEND_URL=http://host.docker.internal:3001` so the JWT audience matches.
