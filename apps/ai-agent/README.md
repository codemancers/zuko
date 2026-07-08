# @zuko/ai-agent

A standalone AI agent for Zuko, built on [eve](https://eve.dev) — Vercel's
filesystem-first agent framework. The agent manages tasks by calling the
Zuko backend's existing `/tasks` REST API, authenticated via the user's
Better Auth session.

## Layout

```
agent/
├── instructions.md       # system prompt
├── agent.ts              # model config (OpenAI gpt-4.1)
├── channels/
│   └── eve.ts            # Better Auth session channel
├── lib/
│   ├── env.ts            # env parsing
│   └── zuko-client.ts    # session-forwarding fetch wrapper
└── tools/                # one file per tool; filename = tool name
    ├── list_tasks.ts
    ├── get_task.ts
    ├── create_task.ts
    ├── update_task.ts
    └── delete_task.ts
```

## Prerequisites

- Node ≥ 24 (eve requirement); bun for installs.
- The Zuko backend running (default `http://localhost:3001`).
- An OpenAI API key (`OPENAI_API_KEY`) — the agent uses gpt-4.1.

## Setup

```sh
cp apps/ai-agent/.env.example apps/ai-agent/.env
# fill in OPENAI_API_KEY
```

## Running

The agent exposes an HTTP session API on port 3002. All requests must carry
the user's Better Auth session cookie — the channel verifies it against the
backend and forwards it to tool calls.

```sh
bun nx run @zuko/ai-agent:dev   # from repo root
# or:
cd apps/ai-agent && bunx eve dev
```

## HTTP API

```sh
# start a session (pass session cookie from browser)
curl -i -X POST http://localhost:3002/eve/v1/session \
  -H 'content-type: application/json' \
  -H 'cookie: better-auth.session_token=<token>' \
  -d '{"message":"list all tasks"}'

# stream the response (NDJSON) — use x-eve-session-id from above response
curl -N http://localhost:3002/eve/v1/session/<sessionId>/stream

# follow-up
curl -X POST http://localhost:3002/eve/v1/session/<sessionId> \
  -H 'content-type: application/json' \
  -H 'cookie: better-auth.session_token=<token>' \
  -d '{"continuationToken":"<token>","message":"create a task called X"}'
```

Get your session token: browser DevTools → Application → Cookies →
`better-auth.session_token`.

## Auth model

The eve channel (`agent/channels/eve.ts`) intercepts every inbound request,
calls `GET /auth/get-session` on the backend (forwarding cookies/headers),
and verifies the user has an active organization. On success it stamps
`orgId`, `userId`, and `sessionCookie` onto `ctx.session.auth.current.attributes`.

Tools read `sessionCookie` from context and forward it to `/tasks` — the
same endpoint the web UI uses. No separate agent credentials needed.

## Build & run (production)

```sh
bun nx run @zuko/ai-agent:build   # eve build
bun nx run @zuko/ai-agent:start   # eve start --port 3002
```

## Docker

```sh
docker build -f apps/ai-agent/Dockerfile -t zuko-ai-agent .

docker run -p 3002:3002 \
  -e OPENAI_API_KEY=... \
  -e ZUKO_BACKEND_URL=http://host.docker.internal:3001 \
  zuko-ai-agent
```

When testing against a local backend, start the backend with
`BACKEND_URL=http://host.docker.internal:3001`.
