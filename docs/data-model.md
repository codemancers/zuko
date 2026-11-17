# Data model and API

A multi-tenant CRM backend on Postgres. Organizations own everything; objects (contact, deal, or
your own) are defined at runtime, so adding a field or a link needs no migration.

## Layers

| Layer | Where | What it does |
|---|---|---|
| Auth | `apps/backend/src/libs/better-auth`, `libs/*` | better-auth with organizations, teams, custom roles, a reporting hierarchy, an audit trail, and an OAuth server for MCP clients |
| CRM API | `apps/backend/src/crm` | objects, fields, records, links, access settings, shares, history |
| MCP server | `apps/backend/src/mcp` | the same operations as MCP tools, for AI clients |
| Data | `apps/backend/prisma` | schema, migrations, row-level security |

## Multi-tenancy

- Every tenant table has an `organizationId` and a row-level security policy on it
  (`enable_tenant_rls`, in `tenancy_foundation`).
- A request runs in a transaction that does `SET LOCAL ROLE zuko_app` and sets `app.org_id`
  (`PrismaService.withTenant`). `zuko_app` is `NOBYPASSRLS`, so the policies apply even when the
  login role owns the tables. An unset `app.org_id` matches no rows (it fails closed).
- Query tenant data only through `withTenant`. Global tables (`user`, `session`, `jwks`, `oauth_*`)
  have no `organizationId`.
- Deploying: the login role that runs the app needs `GRANT zuko_app TO <login_role>`.
- Ids are autoincrement `BIGINT` everywhere and strings in the API. Datetimes are UTC (below).

## Objects, fields and records

- `object_type`: a kind of record. `kind` is `STANDARD` (contact, company, deal, created by
  `POST /setup/standard-objects`) or `CUSTOM`. Standard objects are ordinary: their fields can be
  edited too.
- `field_definition`: a field on an object. Types: `TEXT`, `EMAIL`, `NUMBER`, `BOOLEAN`,
  `TIMESTAMP`, `ENUM`, `LINK`, `USER`. Flags: `required`, `unique`, `filterable`, `readOnly`,
  `sensitive` (redacted in history). The key and type never change once a field exists.
- `object_record`: one row per record. Values of every field except links live in the JSONB
  `properties` column, validated against the field definitions on write. Records are soft deleted
  (`deletedAt`).
- Removing a field is a soft delete: the definition and the stored values stay, the field
  disappears from the object, from record output and from writes, and adding it again with the same
  key and type brings the values back.
- `USER` fields hold a member id (or a list of them) in `properties`, checked against the
  organization's members on write. One can become many and back; values are carried over.

## Links

A link is a `LINK` field on one object (`Primary contact` on deals, `Companies` on contacts). It is
backed by an `association_definition` (source object, target object, `many`, `reverseLabel`) and its
rows live in `association`, never in `properties`.

- A link holds **one** record or **many**, as its field says. The object it points at always sees
  many, under its own label (`reverseLabel`, or `Deals (Primary contact)`).
- Many links may exist between the same two objects (a primary and a secondary contact).
- Where a record holds one, linking another replaces it, from either end. Many can become one only
  when nobody holds several. This is enforced in the service layer (under an advisory lock), not
  by the database.
- A link is a field on the record that holds it, so changing it takes write access to that record
  and read access to the record it points at, whichever end the change is made from. From the end
  that is pointed at, that means write access to each record being linked or unlinked (and the one
  being edited need only be readable). A person never sees, or disturbs, links to records outside
  their scope.
- Soft-deleted records keep their links, hidden until restored.
- Links are addressed by name: `.../records/:id/associations/:link`.

## Permissions

Two layers, both required.

1. **Capabilities**, from `libs/access-control`: roles `owner`, `admin`, `member` and statements
   such as `record: read | create | update | delete | export` and `object: manage` (change the
   schema).
2. **Record scopes**, per role and optionally per object (`role_object_access`): which records a
   person may read and which they may change. Scopes: `OWN`, `OWN_AND_REPORTS` (the reporting
   hierarchy, `member_hierarchy`), `TEAM`, `ALL`. Defaults: owner and admin `ALL`; member reads
   `OWN_AND_REPORTS` and changes `OWN`. Owner and admin are fixed. A record can also be shared with
   a user or team (`record_share`, `READ` or `WRITE`).

A person who may not see a record gets a 404, not a 403, so existence is not leaked.

## History and audit

- `record_change`: one row per create, update or delete of a record, with the old and new values,
  who did it, and how (`USER`, `MCP`, ...). Link changes are recorded as `associations.<link>` on
  both records. Sensitive fields are redacted.
- `audit_event`: authentication and organization events (sign-in, invitations, role and team
  changes, connecting and disconnecting applications).
- Both are append-only: triggers and revoked privileges block updates and deletes. Tests that must
  clean up set the transaction-local flag `app.audit_purge`.

## Datetimes are UTC

Every datetime column is `timestamp(3) without time zone` and holds UTC. Defaults say
`timezone('utc', now())` and the database's timezone is UTC, so nothing depends on a session's local
time. Never use `@db.Timestamptz`. `utc-timestamps.spec.ts` enforces this.

## REST API

All under `/api/v1`, authenticated by the better-auth session cookie. Errors are
`{ code, message, errors? }` with stable codes (`VALIDATION_FAILED`, `NOT_FOUND`, `FORBIDDEN`,
`CONFLICT`, ...).

| Area | Endpoints |
|---|---|
| Who am I | `GET /me` (roles, teams, `can_manage_objects`) |
| Objects | `GET /objects`, `POST /objects`, `GET /objects/:object`, `POST /setup/standard-objects` |
| Fields | `POST /objects/:object/fields`, `PATCH` and `DELETE /objects/:object/fields/:field` |
| Records | `GET`, `POST /objects/:object/records`, `POST .../filter`, `GET`, `PATCH`, `DELETE .../:id`, `GET .../:id/history` |
| Links | `GET`, `PUT`, `POST`, `DELETE /objects/:object/records/:id/associations/:link[/:targetId]`; `GET /associations` |
| Access | `GET /access/roles`, `PUT`, `DELETE /access/roles/:role`; record shares under `.../:id/shares` |
| Directory | `GET /members`, `GET /teams` |
| Connections | `GET /connections`, `DELETE /connections/:id` (MCP clients the user approved) |

Lists take `page`, `page_size` (max 100), `sort` and `include=associations`; filtering takes
filter groups (OR between groups, AND within) over any filterable field.

## MCP server

`/api/mcp` (MCP over HTTP). The backend is also the OAuth authorization server for MCP clients
(better-auth `jwt`, `mcp` and CIMD plugins; discovery under `/.well-known`).

- **Scopes:** `mcp:read`, `mcp:write`, `mcp:delete`. A tool needs its scope, and the user's own
  permissions always apply on top, so a read-only connection can never write, even for an admin.
- **Organization binding:** the user picks an organization when they connect; the token carries it
  (`urn:zuko:org_id`) and every request runs in it.
- **Disconnecting is immediate:** access tokens are valid until they expire, so each request also
  checks that the approval the token was issued under still exists.
- **Tools** mirror the REST operations: `list_object_types`, `describe_object_type`, `list_members`,
  `list_teams`, `list_records`, `filter_records`, `get_record`, `get_record_history`,
  `create_record`, `update_record`, `delete_record`, `list_linked_records`, `link_record`,
  `unlink_record`. Their history entries are recorded with the actor `MCP`.

## Running it

```sh
cp .env.example .env            # then set DATABASE_URL, BETTER_AUTH_SECRET, BACKEND_URL, FRONTEND_URL
createdb zuko
pnpm install
(cd apps/backend && npx prisma migrate deploy)
npx nx serve @zuko/backend      # :3000, rebuild and restart after changes (it does not watch)
npx nx dev @zuko/app            # :4200
```

Tests:

- `npx nx test @zuko/backend` and `npx nx test @zuko/app`. The database-backed backend specs
  need their own database: set `TEST_DATABASE_URL` (see `.env.example`) and never point it at one
  you develop in.
- `npx nx e2e @zuko/backend-e2e` runs against the **running** backend and its database. Specs run
  in parallel, so each cleans up only the rows it created, scoped by a per-run suffix.

## Not done yet

- Invite and verification emails are not sent.
- MCP clients that use CIMD (https client ids) can't be exercised without an HTTPS `BACKEND_URL`.
- Dynamic client registration has no rate limiting.
- A `USER` field keeps a removed member's id.
- The one-record rule for links is enforced in the service, not by a database constraint.
