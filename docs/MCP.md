# Zuko MCP Server

Zuko exposes a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server so AI clients (Claude Desktop, Cursor, VS Code, etc.) can read and write CRM data on behalf of a logged-in user.

The server uses **OAuth 2.1** (RFC 8707 resource indicators, RFC 9728 protected-resource metadata). Clients discover auth endpoints automatically — no manual config beyond the server URL.

## Endpoint

```
POST {BACKEND_URL}/api/mcp
```

Only `POST` is accepted. `GET` and `DELETE` return `405` — the server is stateless (no SSE streams or sessions to manage).

## OAuth flow

1. Client hits `/api/mcp` without a token → gets `401` with `WWW-Authenticate` pointing to `/.well-known/oauth-protected-resource/api/mcp`.
2. Client fetches the protected-resource metadata → discovers the authorization server at `{BACKEND_URL}/auth`.
3. Client fetches `/.well-known/oauth-authorization-server/auth` → gets the standard AS metadata (authorize URL, token URL, JWKS URI, supported scopes).
4. Client sends user through the authorization code flow → user logs in and approves scopes on the consent screen.
5. Client exchanges the code for a JWT access token (audience = `{BACKEND_URL}/api/mcp`).
6. Client sends `Authorization: Bearer <token>` on every MCP request.

Tokens are JWTs verified locally against `{BACKEND_URL}/auth/jwks` — no round-trip to the auth server per request.

## Scopes

| Scope | Grants |
|---|---|
| `organizations:read` | List organizations the user belongs to |
| `tasks:read` | List and retrieve tasks |
| `tasks:write` | Create and update tasks |

## Tools

### `list_organizations`

**Scope:** `organizations:read`

Returns the organizations the authorized user belongs to (id, name, slug, role). Call this first when the user belongs to multiple organizations so you can pass the correct `organizationId` to task tools.

**Input:** _(none)_

**Output:**
```json
[{ "id": 1, "name": "Acme", "slug": "acme", "role": "owner" }]
```

---

### `list_tasks`

**Scope:** `tasks:read`

Returns up to 50 tasks (most recently updated) across all organizations the user belongs to.

**Input:**

| Field | Type | Description |
|---|---|---|
| `status` | `"TODO" \| "IN_PROGRESS" \| "DONE" \| "CANCELLED"` | Filter by status (optional) |
| `organizationId` | `integer` | Restrict to one organization (optional) |

---

### `get_task`

**Scope:** `tasks:read`

Returns full task detail including owners, subtasks, and parent task.

**Input:**

| Field | Type | Description |
|---|---|---|
| `taskId` | `integer` | ID of the task to retrieve |

---

### `create_task`

**Scope:** `tasks:write`

Creates a task in the specified organization. If the user belongs to exactly one organization, `organizationId` can be omitted. If they belong to multiple, call `list_organizations` first to pick one.

**Input:**

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Task title (required) |
| `organizationId` | `integer` | Target organization (optional if user has exactly one) |
| `description` | `any` | Task description in JSON format (optional) |
| `status` | enum | Initial status — defaults to `"TODO"` (optional) |
| `assignee` | `string` | Assignee identifier (optional) |

---

### `update_task`

**Scope:** `tasks:write`

Updates one or more fields on an existing task. Only supplied fields are changed.

**Input:**

| Field | Type | Description |
|---|---|---|
| `taskId` | `integer` | ID of the task to update (required) |
| `title` | `string` | New title (optional) |
| `description` | `any` | New description in JSON format (optional) |
| `status` | enum | New status (optional) |
| `assignee` | `string` | New assignee (optional) |
| `completedAt` | `string` | Completion timestamp in ISO 8601 format (optional) |

## Connecting a client

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zuko": {
      "type": "http",
      "url": "http://localhost:3001/api/mcp"
    }
  }
}
```

Replace `http://localhost:3001` with your backend URL in production.

### Cursor / VS Code

Add a remote MCP server pointing to `{BACKEND_URL}/api/mcp`. The client will handle OAuth discovery and the login flow automatically on first use.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `BACKEND_URL` | `http://localhost:3001` | Public URL of the backend — used in OAuth metadata responses |
| `BETTER_AUTH_URL` | `http://localhost:8000` | Auth server base URL — used by the bearer guard to verify JWTs |
