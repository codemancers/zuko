# Zuko harness

The Eve agent and public MCP server for Zuko's organization-scoped CRM copilot.

## Connect an MCP client

Use `http://localhost:4200/eve/v1/mcp` locally, or `<FRONTEND_URL>/eve/v1/mcp`
in deployment. The harness publishes CRM tools and Eve's `agent_start`,
`agent_get`, `agent_update`, and `agent_cancel` tools on this one endpoint.

The client discovers `${BACKEND_URL}/auth` as the OAuth issuer, registers,
and opens Zuko's login and consent UI. Approval is bound to the selected
organization. Request only the scopes needed:

| Scope            | Access                                                     |
| ---------------- | ---------------------------------------------------------- |
| `records:read`   | List/search/read records, history and relationships        |
| `records:write`  | Create/update records and change relationships             |
| `records:delete` | Delete records                                             |
| `schema:read`    | Discover object types, fields and relationship definitions |
| `directory:read` | List organization members and teams                        |
| `agent:invoke`   | Start, inspect, answer and cancel agent work               |
| `offline_access` | Refresh OAuth access without another login                 |

`records:read` is the default requested scope. Schema-only, directory-only and
agent-only connections are supported; each tool challenges for its own scope.

Authorized mutations execute directly in both MCP tools and Eve agent calls;
there is no additional harness approval step or approval flag. OAuth scopes,
tenant/role permissions, validation and audit history always apply. Direct MCP
tools do not require a model connection. MCP clients may apply their own
confirmation policy independently.

For agent tasks, poll `agent_get`, present any questions or sign-in interactions,
and send question answers with `agent_update`. Poll no faster than the returned
`pollAfterMs`.
Invocations belong to the user, organization and grant that started them.

Disconnect in Zuko's connected-app settings to revoke subsequent CRM access,
including access from queued work. New OAuth access tokens expire in five
minutes. An unexpired JWT may still authenticate for discovery and existing
invocation reads/cancellation after revocation.

`agent_start` and `agent_update` check live access before enqueuing model work.
Requests revoked before that check are refused. The preflight and queueing are
not atomic: later revocation does not forcibly cancel an accepted run, but the
backend still rejects its subsequent CRM operations.

The harness is the only MCP server; the backend exposes OAuth and CRM REST APIs.

## Skills

The harness publishes its skills on the same endpoint (`skill://<name>/SKILL.md`), so
an MCP client can read the procedure behind the tools. `convert-prospect` and
`convert-lead` move a person along the funnel using only the generic record tools:
find, create, link, and mark the source converted last, so running one again after a
failure resumes instead of duplicating. Skills add instructions, never tools, and
every write still goes through your scopes and role permissions.

## Authentication and CRM execution

Better Auth runs in `apps/backend`; `apps/app` hosts login and consent.
`BACKEND_URL` determines the issuer and JWKS. `FRONTEND_URL` determines the
public harness audience. Configure both consistently in all three apps.

The issuer includes an organization-bound grant reference in OAuth and browser
route tokens. The harness verifies signatures, issuer, audience, expiry and
per-tool scopes locally through JWKS. The MCP auth preflight rejects batches
and limits the body to 1 MiB, including chunked requests, before parsing it.
`agent_start` and `agent_update` perform a live delegation preflight before model spending.
The backend checks current consent, membership and readiness when CRM access
is requested. Only a backend grant reference enters durable session attributes;
the caller's bearer token is not retained. Browser sessions obtain backend-signed route
tokens at `POST /api/v1/eve/token`.

The harness exchanges a grant reference at `POST /api/v1/harness/delegate` for
a 60-second token whose audience is the backend CRM API. Exchange also requires
`EVE_AUTH_SECRET`, a service credential shared only by backend and harness
(at least 32 bytes). It is a token-minting credential: possession of it plus a
valid grant reference and organization ID can mint CRM tokens for that grant.
Treat it as a privileged service credential even though it is not the JWT
private signing key. The grant fixes the identity and maximum scopes. Delegation
tokens are cached only in harness memory, by grant and organization, for at most
55 seconds; 401/403 responses invalidate the cache. Every CRM request
rechecks its live session/consent and rebuilds normal tenant/role scopes.
Browser grants stop working on logout, session expiry or organization switch;
OAuth grants expire 14 days after token issuance or refresh.
Revoking consent or reducing its scopes cuts off existing delegations immediately,
including cache hits. The harness enforces the original MCP JWT scopes and
denies tools without a declared scope. The backend checks its own CRM token
and live grant scopes (normally the same set), not the original MCP JWT scopes.
Browser-agent changes are attributed as `AGENT`; external client changes as `MCP`. Explicit bearer credentials take precedence over cookies: an invalid
Authorization header never falls back to a more privileged browser session.

Restrict `/api/v1/harness/delegate` to the harness through private networking or
an ingress rule. Optionally set backend-only `HARNESS_ALLOWED_IPS` to a comma-
separated list of permitted socket peer IPs. This reads the socket peer, never
`X-Forwarded-For`; behind a proxy, restrict the proxy at ingress as well. Configure
rate limits at ingress across replicas. There is no in-process delegation quota,
so normal authenticated harness traffic cannot exhaust a local request bucket.

For key rotation, deploy the backend with a new `EVE_AUTH_SECRET` and the old key
in `EVE_AUTH_SECRET_PREVIOUS`, update the harness to the new key, then remove the
previous key from the backend. Changing keys does not replace consent checks;
already minted CRM tokens live at most 60 seconds and still undergo live checks.

CRM tools call typed REST endpoints; business logic, RLS, validation and history
remain in the backend. Schema and access-administration mutations remain
session-only. No connection back to the public MCP endpoint is needed.

For deployment and reconnect instructions, see [MCP rollout notes](../../docs/mcp-rollout.md).

## Run and verify

Apply the schema before starting the backend, including the edited audit
constraints on existing developer databases. Configure
`EVE_AUTH_SECRET` independently from `BETTER_AUTH_SECRET`, and set
`AI_GATEWAY_API_KEY` for model turns.

Run through Nx from the workspace root:

```bash
pnpm nx dev @zuko/app --port=4200
pnpm nx build harness
pnpm nx typecheck harness
```

The web app starts the harness through `eve/next`. Its proxy maps standard
protected-resource discovery into the harness's `/eve/v1/mcp/metadata` route.

Backend/harness integration tests are in
`apps/backend-e2e/src/backend/eve.spec.ts`. They require both servers on ports
3000 and 4200, a rebuilt backend, and a dedicated test database; never point
these tests at the dev database. Pass the same `EVE_AUTH_SECRET` to servers
and tests. The tests cover real OAuth, delegation, revocation, scopes,
discovery, direct tools and agent invocation ownership without a model key.
Run `pnpm nx test harness` with `DATABASE_URL` and `TEST_DATABASE_URL` set to
that same dedicated backend test database to exercise the tool executors against
real REST services, including mutation validation, audit history and cancellation.
These integration tests skip when `TEST_DATABASE_URL` is unset. They execute tools
independently of model output. A model connection is required to verify full
agent responses.

In development, Eve uses its local Workflow world under `.eve/.workflow-data`.
Organization provisioning uses `@workflow/world-postgres` through the backend.
These stores are separate. If Eve is configured to use Postgres, give it a
separate database rather than sharing organization provisioning's queues.

Clients registered with the retired `mcp:*` scopes must register/connect again
and approve the specific resource scopes. Apply the `harness_grants` schema
migration during rollout. If an existing installation has legacy OAuth data,
clean it up separately before accepting new MCP connections: remove retired
`/api/mcp` resources and their tokens, revoke old `mcp:*` tokens/consents/grants,
remove old client scopes, and update the harness resource's allowed scopes.
Preserve users, CRM data, browser sessions, and current domain-scope grants.
This is a one-time operational cleanup; no cleanup scripts or data migrations
are shipped with the application.

## Runtime dependency ownership

The harness runtime imports `eve`, `better-auth`, `ai` and `zod`; each is declared
in both the root and harness runtime dependencies. `axios` and `pg` are used only
by harness integration tests and remain harness dev dependencies. Production
CRM calls use the platform Fetch API.
