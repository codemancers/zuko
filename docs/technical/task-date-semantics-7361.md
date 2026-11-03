# Task date semantics — technical verification (Gather T01 / #7361)

Branch: `test/task-date-semantics-7361` (base `3d08cef`). Verified 2026-11-02.

This is a verification record, not a design. Sections 1–4 are **observations** of the code as it is, each backed by a code path and, where marked ✅, by an executed characterization test. Section 5 lists executed scenarios, section 6 identifies gaps, section 7 is a **recommended future contract**, and section 8 is the **handoff** to T08 (nullable due date) and T12 (date-filtered history). Nothing in this change alters production code.

Product decisions taken as fixed in Gather #7361 and the Sales Overview ticket briefs (https://app.gatherai.co/tasks/7361; D01/D05 shorthand below):

- Recent work is shared: work associated with organization Owners'/Admins' sales tasks and activities, not filtered solely by the actor's role. The actual actor is retained.
- Needs attention shows due-today and overdue tasks. Undated and future tasks are excluded.
- Recent work defaults to Yesterday, then Today or a chosen date.
- Occurrence time and recorded time are kept apart (especially for backdated work).
- Reuse existing Day.js and date conventions. No new timezone preference, no hardcoded `Asia/Kolkata`, no new date library.

## 1. Inventory: where task dates live

| Field                    | Storage (actual migration SQL)                                                                                                         | Prisma                                                                  | Who writes it                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------- |
| `task.completed_at`      | `TIMESTAMP(3)`, nullable — `libs/models/prisma/migrations/20260313084501_add_tasks_table/migration.sql:11`                             | `DateTime? @map("completed_at")` — `libs/models/prisma/core.prisma:346` | Client-supplied only (see §2). No server stamping. |
| `task.created_at`        | `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` — same migration `:14`                                                               | `@default(now())` — `core.prisma:364`                                   | Insert time                                        |
| `task.updated_at`        | `TIMESTAMP(3) NOT NULL` — same migration `:15`                                                                                         | `@updatedAt` — `core.prisma:365`                                        | Prisma on every update                             |
| `activity.created_at`    | `TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP` — `libs/models/prisma/migrations/20260210054908_add_activity_model/migration.sql:10` | `@default(now())` — `libs/models/prisma/sales.prisma:71`                | Insert time = **recording** time                   |
| `task_owner.assigned_at` | `@default(now())` — `core.prisma:382`                                                                                                  |                                                                         | Insert time                                        |
| due date                 | **does not exist** (no column, DTO field, form field or helper)                                                                        |                                                                         |                                                    |
| activity occurrence time | **does not exist** (`Activity` has only `createdAt`/`updatedAt`; `metadata` is free JSON) — `sales.prisma:62-79`                       |                                                                         |                                                    |

Observations:

- **O1. No column uses `timestamptz`.** A repo-wide search of `libs/models/prisma` finds no `@db.Timestamptz`, `@db.Date`, `TIMESTAMPTZ` or `DATE` type. Every task/activity timestamp is `timestamp without time zone`, precision 3. The application serializes explicit completion instants with UTC ISO strings. The column itself carries no zone; do not infer that every stored value is UTC, especially DB-generated defaults (G8).
- **O2. `Activity` has no `organizationId`** (`sales.prisma:62-79`; also noted at `apps/backend/src/app/mcp/mcp-server.ts:46`). Org scoping of history has to join through the entity (`task.organization_id`).
- **O3. No backend or frontend code configures a process or DB timezone for tasks.** The only timezone-aware code is the meeting feature (`dayjs/plugin/timezone` in `apps/backend/src/utils/meeting.ts:4`, `apps/web/src/components/meeting/*`), which stores an explicit per-meeting IANA zone. Task code uses plain `dayjs` with no `utc`/`timezone` plugin, so the browser's local zone applies.

## 2. Write paths for `completedAt` and task status

| Path                                  | Code                                                                                                                                                                     | Value sent / stored                                                                                                         | Activity row?                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Tasks list "Mark complete"            | `apps/web/src/components/Tasks/TasksList.tsx:74-79`                                                                                                                      | `{ status: 'DONE', completedAt: new Date().toISOString() }`: the **browser clock** as a UTC ISO instant ✅                  | `task_status_changed` (if status changed), actor = session user                                 |
| Task detail "Completed" property      | `apps/web/src/components/Tasks/TaskDetail.tsx:260-266` → `EntityProperties.tsx:245-246`                                                                                  | Picked `YYYY-MM-DD` → `new Date('YYYY-MM-DD').toISOString()` = **UTC midnight** of that date ✅                             | **None** ✅                                                                                     |
| Task detail "Status" property         | `TaskDetail.tsx:230-244`                                                                                                                                                 | `{ status }` only; `completedAt` untouched                                                                                  | `task_status_changed`                                                                           |
| Task edit form                        | `apps/web/src/components/Tasks/TaskForm.tsx:157-165`                                                                                                                     | `{ status: 'DONE', … }` with **no `completedAt`** ✅                                                                        | `task_status_changed`                                                                           |
| Tasks table date cell (`completedAt`) | `apps/web/src/components/Table/CellEditors.tsx:93-116` → `apps/backend/src/app/sales/table/table.service.ts:541-553` → `libs/sales/src/lib/utils/custom-fields.ts:22-25` | `YYYY-MM-DD` → server `dayjs('YYYY-MM-DD').toISOString()` = **server-local midnight** (depends on server `TZ`) ✅           | **None**: direct `prisma.task.update`, bypasses `TaskService`; `actorId` is received but unused |
| Tasks table status cell               | same `table.service.ts:541-553` (status column `editable: true`)                                                                                                         | `status` only                                                                                                               | **None**                                                                                        |
| REST `PATCH /tasks/:id` (any client)  | `apps/backend/src/app/tasks/dto/update-task.dto.ts:41-42` → `TaskService.updateTask`                                                                                     | `completedAt` passed through as the **raw JSON string**, not converted to `Date`, not validated ✅                          | see §3                                                                                          |
| Parent → subtask cascade              | `libs/sales/src/lib/services/task.service.ts:120-126` → `task.repository.ts:313-317`                                                                                     | Copies the parent's `completedAt` and `DONE` onto all direct subtasks (`updateMany`); overwrites any existing subtask value | **None** for subtasks ✅                                                                        |
| MCP `create_task`                     | `apps/backend/src/app/mcp/mcp-server.ts:373`                                                                                                                             | direct Prisma create; no `TaskOwner`, no `completedAt` input                                                                | **None**                                                                                        |
| MCP `update_task`                     | `mcp-server.ts:418-421, 482-485`                                                                                                                                         | `new Date(completedAt)` from an ISO string; status DONE does not stamp `completedAt`                                        | **None**                                                                                        |

Observations:

- **O4. `completedAt` is an instant chosen by the client.** The server never stamps it. A status change to DONE through the form, the detail Status property, the table or MCP leaves it `null`. Reopening (DONE → TODO) does not clear it either: `TaskService.updateTask` passes the DTO through unchanged (`task.service.ts:69-76`).
- **O5. The DTO type `Date` is nominal only.** `ValidationPipe({ transform: true })` (`apps/backend/src/main.ts:16-21`) has no `@Type(() => Date)` or implicit conversion, and there is no `@IsDateString`. So `'2026-11-03'`, `'2026-11-03T00:00:00+05:30'` and `'not-a-date'` all reach `TaskService` as strings ✅. What Prisma then does with a date-only or invalid write was **not verified** (this investigation made no database writes).
- **O6. The three date pickers in use all post a bare `YYYY-MM-DD`,** which is calendar-day intent. Then they convert it inconsistently: the detail view converts to an instant at **UTC midnight** in the browser, and the table cell converts to **server-local midnight** on the backend.

## 3. Read and render paths

| Surface                                           | Code                                                                                          | Semantics                                                                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Detail property display (`renderType: 'date'`)    | `apps/web/src/components/shared/EntityProperties.tsx:548-549`                                 | `dayjs(value).format('MMM D, YYYY')`, **browser-local** day ✅                                                                                |
| Detail property editor seed                       | `EntityProperties.tsx:266-270`                                                                | `new Date(v).toISOString().split('T')[0]`, **UTC** day ✅                                                                                     |
| Detail property no-op check                       | `EntityProperties.tsx:225-240`                                                                | Compares `dayjs(old).format('YYYY-MM-DD')` (local) with `dayjs(picked).format(...)` (local midnight parse) ✅                                 |
| Table date cell display                           | `apps/web/src/components/Table/TableFields.tsx:192` → `apps/web/src/lib/format-utils.ts:6-10` | `formatDate` → `dayjs(v).format('DD MMM YYYY')`, **browser-local** ✅                                                                         |
| Table date cell editor seed                       | `CellEditors.tsx:100-104`                                                                     | `toISOString().split('T')[0]`, **UTC** day ✅                                                                                                 |
| Task header "Created"                             | `apps/web/src/components/shared/DetailHeader.tsx:39`                                          | `dayjs(createdAt).format('MMMM D, YYYY')`, browser-local                                                                                      |
| Activity timeline time                            | `apps/web/src/components/Activity/ActivityTimeline.tsx:292`                                   | `dayjs(activity.createdAt).fromNow()`. Only the **recording** time, relative. No absolute date, no occurrence time ✅                         |
| Activity timeline actor                           | `ActivityTimeline.tsx:286-289`                                                                | `activity.actor.name`; `'System'` when `actorId` is null ✅                                                                                   |
| Timeline query                                    | `libs/sales/src/lib/repositories/activity.repository.ts:76-82`                                | `orderBy createdAt asc`, `take 50`: the **oldest** 50 rows per entity                                                                         |
| Chats list (only existing Today/Yesterday helper) | `apps/web/src/components/Chat/ChatsList.tsx:19-30`                                            | Private `formatDate` that uses `floor((now - t)/86400000)`. These are **24-hour buckets, not calendar days**. Not exported; not used by tasks |

**O7. No shared date-boundary helper exists.** There is no exported "today", "yesterday", "start of day", "is overdue" or "due today" helper anywhere in `apps/` or `libs/`. The only shared date helper is `formatDate` (display only, `format-utils.ts:6`). `DateInput` in `libs/ui-kit/src/lib/date-input.tsx` parses `YYYY-MM-DD` strictly with `customParseFormat`, but no task UI uses it.

## 4. Activity history: occurrence vs recording, and actor

- **O8. Task history has one timestamp, `activity.createdAt`, which is the recording time.** `TaskActivityListener` (`libs/sales/src/lib/listeners/task-activity.listener.ts`) never passes a time. `TaskStatusChangedEvent` carries only `{ taskId, actorId, from, to }` (`libs/sales/src/lib/events/task-events.ts:8-18`).
- **O9. A backdated completion is recorded "now".** `PATCH { status: 'DONE', completedAt: '2026-10-30T09:00Z' }` writes the task's `completedAt = Oct 30` but emits one `task_status_changed` row with `createdAt = now` and no reference to Oct 30 ✅. The timeline shows "a minute ago — moved task from To Do to Done" ✅.
- **O10. Changing only `completedAt` leaves no trace in history** ✅. `completedAt` is not in `trackedFields` (`task.service.ts:96-101`).
- **O11. Actor association is correct on REST paths only.** The controller takes `actorId = Number(req.user.id)` for both owner and actor (`tasks.controller.ts:70-74`) ✅, and every emitted event carries it to `activity.actor_id`. The table-cell, MCP and subtask-cascade paths write task rows **without any activity**, so they have no actor (§2).
- **O12. Owner/Admin association is available only indirectly.** `Member.role` is a free string per org (`core.prisma:254-260`, default `"member"`). A task relates to users through `assigneeUserId` (stable assignee), `TaskOwner` (creator; `isPrimary`) and `activity.actorId`. No role is snapshotted at the time of the work. `TaskOwner` is created only on REST create (`task.repository.ts:194-197`), not on MCP create.

## 5. Proven scenarios (executed)

All zones are pinned per test via `process.env.TZ`. Each test asserts the expected UTC offset first, so it fails loudly if the runtime ignores the switch. The machine timezone is not changed. The tests are also re-run under `TZ=Pacific/Kiritimati` (UTC+14) to show they don't depend on the host zone (§8).

| #   | Scenario                                                            | Result                                                                                                                                   | Test                                                             |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| S1  | Same stored instant `2026-11-02T20:00Z` rendered by the detail view | UTC **Nov 2**, Asia/Kolkata **Nov 3**, America/Los_Angeles **Nov 2**: the day depends on the viewer's zone                               | web `renders one stored instant in the browser zone`             |
| S2  | Same instant: detail display vs picker seed (Kolkata)               | Displays **Nov 3**, picker opens on **2026-11-02**                                                                                       | web `seeds the picker with the UTC calendar day…`                |
| S3  | Kolkata user re-picks the day they see (2026-11-03)                 | **Save silently skipped** (no-op check compares local days)                                                                              | web `ignores a pick of the displayed local day…`                 |
| S4  | Backdate by picking 2026-11-03 (detail view)                        | Saves `2026-11-03T00:00:00.000Z` in every zone. Then shows **Nov 3** in UTC/Kolkata and **Nov 2** in Los Angeles (off by one)            | web `saves a backdated pick of 2026-11-03 as UTC midnight…`      |
| S5  | DST end day: New York picks 2026-11-01                              | Saves `2026-11-01T00:00Z`, which displays **Oct 31**                                                                                     | web `saves a DST-day pick as UTC midnight…`                      |
| S6  | DST boundary: `2026-11-02T04:30Z` in New York                       | **Nov 1** (EST, UTC-5). A fixed pre-change offset (-4) would give Nov 2: day boundaries need zone rules, not a stored offset             | web `crosses the day on a DST change by zone rules…`             |
| S7  | Midnight: "Mark complete" at 00:00 local on Nov 3 in Kolkata        | Sends `2026-11-02T18:30:00.000Z`. `slice(0,10)` gives **2026-11-02** while the user's day is **Nov 3**                                   | web `writes the browser clock as a UTC instant…`                 |
| S8  | Table cell (Kolkata): display vs editor                             | `formatDate` → **03 Nov 2026**, editor seed **2026-11-02**                                                                               | web `displays the local day but edits the UTC day`               |
| S9  | TaskForm status → Done                                              | Payload has `status: 'DONE'`, **no `completedAt`**                                                                                       | web `sends status DONE without completedAt`                      |
| S10 | Timeline for a completed task                                       | Shows actor + "a minute ago" + "moved task from To Do to Done". No absolute or occurrence date. A null actor renders "System"            | web `shows recording time relative to now…`                      |
| S11 | Table date cell write `2026-11-03` on the server                    | UTC server → `2026-11-03T00:00Z`. Kolkata server → `2026-11-02T18:30Z`. LA server → `2026-11-03T08:00Z`. A full ISO instant is unchanged | sales `turns date-only "2026-11-03" into server-local midnight…` |
| S12 | Backdated completion via `TaskService`                              | Task gets `completedAt = Oct 30`. Exactly one activity `{task_status_changed, actorId 42, {from,to}}` with no time field                 | sales `records a backdated completion…`                          |
| S13 | `completedAt`-only correction                                       | No events, no activity                                                                                                                   | sales `records nothing when only completedAt is changed`         |
| S14 | Status DONE without `completedAt`                                   | Repository update has no `completedAt`; no cascade                                                                                       | sales `does not stamp completedAt…`                              |
| S15 | Parent completion cascade                                           | `updateSubtasksCompletedAt(7, at)` called. Activity rows only for parent 7                                                               | sales `copies the parent completedAt onto subtasks…`             |
| S16 | HTTP `PATCH completedAt` as ISO, date-only, offset and garbage      | All accepted (200) and passed to the service as the identical **string**. `null` passes through                                          | backend `passes completedAt … as the raw string`                 |
| S17 | HTTP `POST` actor                                                   | `createdByUserId` and `actorId` both equal the session user (11)                                                                         | backend `attributes creation to the session user…`               |

## 6. Gaps (truthful list)

- **G1. No occurrence time in history (blocks the D01 "occurrence vs recorded" requirement).** A backdated completion is recorded only at `activity.createdAt` (S12, S10). The real occurrence is only in `task.completedAt`, which is mutable and has no history (S13).
- **G2. Day-picker → instant conversion is wrong for negative-offset zones** (S4, S5) and server-zone dependent on the table path (S11). Picker seed and display disagree for positive offsets (S2, S8), and the no-op check can swallow a real correction (S3).
- **G3. `completedAt` is not tied to status.** DONE without `completedAt` (S9, S14, MCP, table), and reopening doesn't clear it (O4). A "completed yesterday" query on `completedAt` would miss form/table/MCP completions entirely.
- **G4. Writes that bypass `TaskService` lose history and actor:** table cells, MCP create/update, and the subtask cascade (O11, S15).
- **G5. `completedAt` input is unvalidated** (S16). The Prisma behaviour for date-only or garbage strings was not verified.
- **G6. No calendar-day helper exists** (O7). The only Today/Yesterday logic (`ChatsList`) uses 24-hour buckets and must not be reused for D05 boundaries.
- **G7. The timeline fetches the oldest 50 rows** (`activity.repository.ts:80-81`). A date-filtered history cannot be built on `getTimeline`.
- **G8. Timestamp columns are `timestamp without time zone`.** Do not assume all writes/readbacks are UTC-safe. **Not verified**: whether each `@default(now())` insert is filled by Prisma or by the DB `CURRENT_TIMESTAMP` default. Read-only checks against the isolated preview DB found session timezone `Asia/Kolkata`; this is not a product timezone policy. Casting `CURRENT_TIMESTAMP` to a timezone-less column uses that session zone. The raw-query adapter check below also showed an offset-handling discrepancy. Audit the relevant write/read path before T12 relies on `created_at` boundaries; no timezone or data was changed here.

## 7. Recommended future contract (not implemented)

These are recommendations. Nothing below exists in the code today.

**Calendar-day values (due date).** Every picker in use emits `YYYY-MM-DD` (O6), and "due today/overdue" is a calendar question. So store due dates **date-only**: Postgres `DATE` via `DateTime? @db.Date` (nullable). Transport them as `YYYY-MM-DD` strings in both directions. Keep date-only strings in the UI and API. The repository may deliberately map a validated date to/from Prisma’s UTC-midnight `Date` representation (see T08 below), but must not apply local-time conversion. Do not reuse `EntityProperties`' instant-oriented save path or `castFieldValue` unchanged (S4, S11).

**"Today" is the viewer's browser-local day.** This follows D05 and S1 and needs no new preference. The client computes `dayjs().format('YYYY-MM-DD')` and sends it as the reference day.

- Due today: `dueDate = today`.
- Overdue: `dueDate < today`, not completed.
- Both exclude `dueDate IS NULL` and `dueDate > today`.

**Instants (`completedAt`, history).** Keep them as instants. For day filters, the client converts its local day to `[start, end)` instants with `dayjs(day).startOf('day')` and `.add(1, 'day').startOf('day')` (S6 shows these are DST-correct only through zone rules) and sends ISO bounds. The server filters `>= start AND < end`. Never group by `toISOString().slice(0,10)` (S7).

**Occurrence vs recording.**

- History rows carry **occurredAt** (when the work happened), **recordedAt** (`activity.createdAt`, unchanged) and **actorId** (session user, unchanged).
- For task completion, snapshot the completion instant in the event when the work is recorded; do not rebuild historic occurrence times from the task’s mutable current `completedAt`.
- When completion has no `completedAt` (G3), `occurredAt` falls back to the recording time and the row is marked as such.
- A date picked for a backdated completion should become a **local** instant (for example `dayjs('YYYY-MM-DD')`, local midnight, or a time the user chooses), not UTC midnight.

## 8. Handoff

### T08: nullable due date

1. Schema: add `dueDate DateTime? @map("due_date") @db.Date` to `Task` (`core.prisma:338-375`) with an index for the attention query. Prisma represents `@db.Date` as a JS `Date` at UTC midnight. Serialize it on the server as `date.toISOString().slice(0,10)` (correct only because the column is a UTC-midnight `DATE`) or map it explicitly. Add a migration only; existing rows stay `NULL`.
2. DTOs (`create-task.dto.ts`, `update-task.dto.ts`): `dueDate?: string | null`, validated as strict `YYYY-MM-DD` (unlike `completedAt`, G5). `null` clears, omission keeps. Add to `writableFields` (`task.repository.ts:53-61`). History tracking and display of reschedules belong to the later action/history tickets; do not add timeline UI in this backend-only ticket.
3. Web types (`apps/web/src/lib/api/tasks.ts:26-87`): `dueDate?: string | null`.
4. **Separate T09 UI follow-on, not T08:** `TaskForm` needs a date field. Only dashboard creation defaults to today; generic creation must not silently date existing or undated tasks. Do **not** reuse `EntityProperties` `fieldType: 'date'` or `CellEditors.DateEditor` / table `castFieldValue` unchanged: they convert days to instants (S4, S8, S11). Either add a date-only mode there or keep the raw string. Display with `dayjs(day, 'YYYY-MM-DD')`, which is local-parsed and therefore stable.
5. **Separate T10 query follow-on, not T08:** the client sends `today=YYYY-MM-DD`. The server filters `dueDate <= today AND dueDate IS NOT NULL AND status NOT IN (DONE, CANCELLED)` and splits due-today vs overdue by equality. Eligibility follows D01: tasks associated with an org Owner/Admin via **`assigneeUserId` only**, joined to current-org `Member.role` (O12). `TaskOwner` is creator/ownership metadata and must not qualify an unassigned or Member-assigned task. The actor's role does not decide eligibility.
6. Tests to add with T08: date-only round-trip in negative and positive zones (reuse the TZ-pinning pattern in `apps/web/__tests__/task-date-semantics.test.tsx`), plus null, future and today boundaries at local 23:59 and 00:00.

### T12: date-filtered history (Recent work)

1. Occurrence field: add an `occurredAt` to `Activity` (`sales.prisma:62-79`), nullable for old rows. Prefer a real column over `metadata` so it can be indexed with `(entityType, entityId, occurredAt)`. Keep `createdAt` as recorded time. Read-model fallback: `occurredAt ?? createdAt`, labelled.
2. Completion events: emit a completion fact carrying `completedAt` and the actor whenever completion or `completedAt` changes (fixes G1, G3, S13). Route table-cell, MCP and cascade writes through `TaskService`, or have them emit the same events (G4). Subtask cascade rows should get the parent actor and the same `occurredAt`.
3. Query: a new org-scoped endpoint (not `getTimeline`, G7). The client sends local-day `[start, end)` ISO bounds for Yesterday (default), Today or a chosen date (§7). The server filters on `occurredAt` (with fallback) and joins `task.organization_id` (O2). It includes work on tasks associated with Owner/Admin members (D01, O12) and returns the actual `actor` separately from the owner.
4. Display: show occurrence time as an absolute local time. Also show recorded time when it differs (backdated). The existing `fromNow()` (S10) is not enough for a date-filtered feed.
5. Before relying on `created_at` boundaries, confirm G8 read-only.

## 9. How to reproduce

New test files (characterization only; no production code changed):

- `apps/web/__tests__/task-date-semantics.test.tsx` (14 tests)
- `libs/sales/src/lib/services/task-date-semantics.spec.ts` (8 tests)
- `apps/backend/src/app/tasks/tasks.date-semantics.spec.ts` (6 tests)

```bash
(cd apps/web      && pnpm exec vitest run __tests__/task-date-semantics.test.tsx)
(cd libs/sales    && pnpm exec vitest run src/lib/services/task-date-semantics.spec.ts)
(cd apps/backend  && pnpm exec vitest run src/app/tasks/tasks.date-semantics.spec.ts)
# Host-zone independence:
(cd apps/web   && TZ=Pacific/Kiritimati pnpm exec vitest run __tests__/task-date-semantics.test.tsx)
(cd libs/sales && TZ=Pacific/Kiritimati pnpm exec vitest run src/lib/services/task-date-semantics.spec.ts)
```

The new characterization tests do not touch a database. Independent final full-suite verification used the isolated `zuko_cm_preview` database: backend **453/453**, sales **288/288**, web **367/367** tests passed, including the existing DB-backed suites. No new production code or migrations are included.

### Read-only local database evidence

`information_schema.columns` confirms task/activity date columns are `timestamp without time zone`. `SHOW TimeZone` returned `Asia/Kolkata` in the isolated preview database. A PrismaClient/PrismaPg raw SELECT (no mutation) returned:

```text
now()::text                       2026-11-02 13:26:01.790146+05:30
now() serialized by adapter       2026-11-02T13:26:01.790Z
(now() AT TIME ZONE 'UTC')::text 2026-11-02 07:56:01.790146
UTC wall-time parsed by adapter   2026-11-02T07:56:01.790Z
```

The raw instant readback disagrees with its text offset. This does **not** prove every task timestamp is wrong, but rules out assuming raw DB timestamps are automatically UTC-safe. Neither DB settings nor existing data were changed. Production behaviour is unverified.

## 10. Not verified / blockers

- Prisma's write response to date-only or invalid `completedAt` strings (G5), the `@default(now())` fill source, and production DB timezone remain unverified. The independent database investigation was read-only and local; full existing regression suites used their isolated temporary fixtures.
- Standard web typecheck (`pnpm exec tsc --noEmit -p apps/web/tsconfig.json`) and backend/sales Nx typechecks passed. The standalone web spec-project check (`tsc -p apps/web/tsconfig.spec.json`) has existing project-reference errors (TS6305/TS6306); do not claim that standalone spec-project check passed. All new tests were executed successfully by Vitest, with web/sales characterization tests also passing under an alternate host `TZ=Pacific/Kiritimati`.
