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
