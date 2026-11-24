<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI conventions

- **Lists are sheets.** Always `@codemancers/sheets`, never a table or card list. One scrolling list like Google Sheets: no pagination (fetch every page, cap and say so). Sort and search run on the server.
- **Edit in place.** Cells save a row at a time (`useRowChanges`) and show saving/saved/refused; every kind of field has an in-place cell. The drawer keeps the full record, its links and **Delete** (deleting lives only there).
- **Adding a record adds a row** (the first field, pinned at the bottom). Only an object with another required field gets the drawer form.
- **Forms and details open in the right-hand drawer** (`ui/drawer`), never a centred dialog.
- **The URL holds view state:** `?q`, `?sort`/`?order`, `?open`, `?new`, `?add_field`, `?edit_field`. Write it with `router.replace`, ignore invalid values, and restore everything from it on load.
- **Fields are managed from the sheet:** the cog in a header opens that field's settings, the **+** column adds one. Key and type never change (shown disabled). Owners and admins only, from `can_manage_objects` on `/api/v1/me`; the server enforces it.
- **Links are fields.** A link is a field on one object ("Primary contact" on deals), added from that object's page; the Objects settings page does not manage links. It holds one record or many (the field's choice); the object it points at shows the same links automatically, always many. Never a text field naming another record. A link column's cell links/unlinks in place (always with a **+**); the drawer has the same controls. User fields (a member, or several) work the same way.
- **Show the server's reason** where the problem is (the cell, the field), keep what was typed, and never swallow an error.
- **Check it for real:** run the servers, drive the change with `agent-browser`, and clean up any test data you create.
