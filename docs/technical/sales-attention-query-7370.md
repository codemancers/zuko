# Needs attention task query — Gather #7370

`GET /api/sales-overview/needs-attention?date=YYYY-MM-DD&page=1&limit=50`

- Requires authenticated active-organization Owner/Admin membership via the existing SalesOverviewGuard. Responses use `Cache-Control: private, no-store`.
- `date` is required: send the viewer's local calendar day (existing UI convention: `dayjs().format('YYYY-MM-DD')`). It is a date-only cutoff, not a timestamp. No server-timezone fallback or new timezone setting.
- `page`: integer 1–1,000,000, default 1. `limit`: integer 1–100, default 50. Invalid date/pagination returns 400.
- Returns `{ tasks, pagination: { page, limit, total, totalPages } }` using existing task query conventions. Empty pages return `tasks: []`.
- Each row includes `id`, `title`, `status`, `priority`, `dueDate` (YYYY-MM-DD), `parentId`, `assigneeUserId`, `assigneeUser: { id, name }`, `contactId`, `prospectId`. Existing authorized task detail endpoint provides richer detail.
- Selects active-org `isSales` tasks with status TODO/IN_PROGRESS, a non-null due date on/before the cutoff, and a stable assignee whose current membership in that org is owner/admin. Shared across eligible assignees, not restricted to the viewer.
- Sort: dueDate ascending, then id ascending. Includes eligible subtasks. TaskOwner creator links and legacy assignee names do not determine eligibility or multiply rows. Membership is checked on every query.
- Status is authoritative for completion, consistent with the existing task workflow. This endpoint never changes tasks, permissions, history, or completion timestamps.
- No schema migration or UI change. Row rendering is #7392; review/actions are #7371.

## Verification

Build shared exports before backend tests (`@zuko/sales` resolves its built dist):

```sh
NX_DAEMON=false pnpm exec nx run @zuko/sales:build --skip-nx-cache
pnpm --dir libs/sales exec vitest run src/lib/repositories/task-attention.spec.ts
pnpm --dir apps/backend exec vitest run src/app/sales-overview/sales-overview.spec.ts
```

Opt-in persisted HTTP test, from `apps/backend`:

```sh
ZUKO_PREVIEW_DB_TESTS=1 node --env-file=../../.env.local ../../node_modules/vitest/vitest.mjs run src/app/sales-overview/sales-overview.persistence.spec.ts
```

The persisted test refuses any database other than localhost/127.0.0.1 `zuko_cm_preview`. It exercises the real module, repository and membership guard, with fixture authentication. All fixture writes run in a rolled-back transaction, with cleanup readback assertions. Do not enable it against production or a remote database.
