# Zuko harness

The Eve agent that powers Zuko's organization-scoped CRM copilot.

Run it through Nx from the workspace root:

```bash
pnpm nx dev harness
pnpm nx build harness
pnpm nx typecheck harness
```

The Zuko web app starts the harness automatically in development through its
`eve/next` integration. Configure `EVE_AUTH_SECRET` with the same value as the
backend and set `AI_GATEWAY_API_KEY` for model turns.

In development, Eve uses its local Workflow world under `.eve/.workflow-data`.
Organization provisioning uses `@workflow/world-postgres` through the NestJS backend;
the Next.js setup route only reads that Postgres world. These stores are separate.
If Eve is later configured to use Postgres, give it a separate database rather than
sharing the organization provisioning world and its queue.
