# MCP rollout notes

The public MCP endpoint is `<FRONTEND_URL>/eve/v1/mcp`. The backend remains the
OAuth issuer at `<BACKEND_URL>/auth`; its old `/api/mcp` endpoint is retired.

1. Apply the `harness_grants` schema migration from PR #23 if it has not been
   applied. Because this schema has not been deployed to production, the
   existing audit migration now permits `AGENT` in its check constraints.
   A developer database that already applied the earlier audit migration needs
   those two check constraints updated in place; preserve its existing rows.
   No new migration or database reset is required for this follow-up.
2. Deploy the backend, harness, and web app together. Keep `BACKEND_URL`,
   `FRONTEND_URL`, and the active service credential consistent.
3. Restrict `/api/v1/harness/delegate` to private harness traffic at ingress.
   See the [harness deployment notes](../apps/harness/README.md) for the socket
   peer allowlist, ingress-wide rate limits, and staged key rotation.
4. On existing installations, perform the separate one-time legacy OAuth
   cleanup: remove retired `/api/mcp` resources and their tokens; revoke
   `mcp:read`, `mcp:write`, and `mcp:delete` tokens, consents, and grants; remove
   those client scopes; and configure the harness resource's domain scopes.
   Preserve current domain-scope grants, browser sessions, and CRM data. No
   operational cleanup scripts are shipped with the app.
5. Tell users with legacy MCP connections to reconnect and consent to domain
   scopes. Tokens issued before PR #23's grant-reference claim also need a
   refresh or reconnect. Keep the existing domain-scoped connections intact.

New OAuth access tokens expire in five minutes; already-issued tokens keep
their original expiry (the previous default was one hour). Disconnecting a
client is refused by `agent_start` and `agent_update` when revocation precedes
the live preflight, and subsequent CRM calls are refused even with a cached
delegation token. The preflight and queueing are not atomic: revocation after
the check does not forcibly cancel accepted model work. Discovery and existing
invocation reads/cancellation can remain available until JWT expiry. Five
minutes is the accepted window for newly issued OAuth access tokens; existing
tokens keep their original expiry. The backend rechecks live access for each
CRM call.

CRM history distinguishes browser-agent changes (`AGENT`, displayed as
"via agent") from external MCP client changes (`MCP`, displayed as "via MCP").
Existing historical rows keep their original attribution.

MCP JSON-RPC batches are now rejected, including the older protocol profiles.
Send one request per HTTP POST; request bodies are limited to 1 MiB.
