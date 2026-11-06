# Task Review membership prerequisite — Gather #7371

## Current status

The prerequisite membership fix is implemented and verified locally after approval to proceed. #7371's Review/Done/reschedule UI and completion-history changes are not implemented. This change is the membership prerequisite only, not completion of #7371.

## Original reproduction

From apps/backend: `pnpm exec vitest run src/app/tasks/task-mutation-boundary.audit.spec.ts`.
Before the fix, the test received HTTP 200 instead of 403 and TaskService.updateTask was invoked with organization 7, task 434, status DONE, actor 1.
The test uses the real TasksController and OrganizationGuard with fixture authentication, membership and a task-service spy; it never modifies real task 434. It demonstrates the stale-session guard/controller composition, not an end-to-end exploit against a real account.

## Cause and narrow fix

The shared organization resolver checked membership for an explicit header, but could fall back to a stale session organization without checking membership. It now:

- Requires current membership for a resolved session organization, including single-org fallback.
- Rejects an unauthorized explicit organization instead of silently falling back.
- Requires positive safe integer identifiers rather than accepting partial parseInt values.
- Keeps role rules unchanged: current Member, Admin and Owner users retain ordinary task access. Dashboard access still separately requires Owner/Admin.

No task endpoint, schema, assignment rule or task-level role policy changed. The one production file changed is `apps/backend/src/common/auth/get-organization-id.ts`.

## Verification

- Failing-first boundary tests: 19 failed / 3 passed before the fix; the stale-session HTTP probe now returns 403 and never calls the task service.
- Added HTTP assertions preserve authorized Member/Admin/Owner rescheduling and reject a foreign explicit organization.
- Existing dashboard guard test fixtures now keep a role downgrade/removal in effect across repeated membership reads instead of returning an old admin role on the next lookup. Denials still assert ForbiddenException.
- Real local-preview transaction test confirms ordinary member access is retained and a persisted membership deletion rejects the stale session. Fixture writes roll back; cleanup assertions pass.
- Guarded full backend suite: 35 files / 587 tests passed, with preview persistence enabled.
- Full frontend suite: 25 files / 417 tests passed.
- Backend TypeScript, targeted lint (zero warnings/errors), canonical `pnpm run fmt` and `git diff --check` passed.
- Signed-in local dashboard smoke check: HTTP 200, task 434 remains DONE and correctly absent, empty state visible, task unchanged, zero page errors.
- Expected negative-path warning/error logs remain in the backend test suite; passing counts do not mean logs are empty.

## Remaining #7371 work

Task Review, explicit Done and reschedule controls still need implementation and their own tests. Current status-only Done does not set completedAt automatically, and task/history writes need retry-safe handling to meet the ticket's actual-actor/time-once requirement. TaskDetail contains autosaving fields and cannot simply be mounted as a read-only Review without preventing open/close writes.
