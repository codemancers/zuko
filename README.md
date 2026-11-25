# Zuko

A multi-tenant CRM backend and web app: runtime-defined objects and fields, links between records
that hold one record or many, role and team based record access, a full audit trail, and an MCP
server so AI clients can work with the same data under the user's own permissions.

- **How it works, the API, permissions and the MCP server:** [docs/data-model.md](docs/data-model.md)

## Getting started

```sh
cp .env.example .env            # set DATABASE_URL, BETTER_AUTH_SECRET, BACKEND_URL, FRONTEND_URL
createdb zuko && pnpm install
(cd apps/backend && npx prisma migrate deploy)
npx nx serve @zuko/backend      # http://localhost:3000
npx nx dev @zuko/app            # http://localhost:4200
```

See [docs/data-model.md](docs/data-model.md#running-it) for the tests, including the database one.

## AI development tooling

[Ponytail](.agents/skills/ponytail/SKILL.md),
[Caveman](.agents/skills/caveman/SKILL.md), and
[Vercel React Best Practices](.agents/skills/vercel-react-best-practices/SKILL.md) are installed through
[skills.sh](https://skills.sh) for both Codex and Claude Code. Ponytail is the
default development workflow in **full** mode; Caveman's voice is opt-in with
`/caveman`. See [AGENTS.md](AGENTS.md#ai-development-workflow) for installation,
updates, and local output compression instructions.

**Caveman progress (2026-11-25):** following Sikaram's incremental adoption
approach, keep normal communication and existing model choices while evaluating
local usage analysis and selective compression of large command outputs. Both
skills and Claude Code links are installed. The existing standalone Caveman CLI
4.2.0 analyzed four local Zuko Codex sessions; its findings are estimates, and
it did not produce a setup score. No Zuko token savings have been measured yet.

Before expanding use, compare total token use, elapsed time, and the effort to
recover original output on representative builds, tests, and failure investigations.
Verify that errors, exit codes, and diagnostic details remain available. Sikaram's
initial small backend test log showed no reduction; its synthetic noisy-log checks
verified compression and recovery, not project-wide savings. Keep Zuko's local
reports under ignored `tmp/caveman/`.

---

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

✨ Your new, shiny [Nx workspace](https://nx.dev) is ready ✨.

[Learn more about this workspace setup and its capabilities](https://nx.dev/nx-api/node?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or run `npx nx graph` to visually explore what was created. Now, let's get you up to speed!

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve backend
```

To create a production bundle:

```sh
npx nx build backend
```

To see all available targets to run for a project, run:

```sh
npx nx show project backend
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/node:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/node:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Set up CI!

### Step 1

To connect to Nx Cloud, run the following command:

```sh
npx nx connect
```

Connecting to Nx Cloud ensures a [fast and scalable CI](https://nx.dev/ci/intro/why-nx-cloud?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) pipeline. It includes features such as:

- [Remote caching](https://nx.dev/ci/features/remote-cache?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task distribution across multiple machines](https://nx.dev/ci/features/distribute-task-execution?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Automated e2e test splitting](https://nx.dev/ci/features/split-e2e-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Task flakiness detection and rerunning](https://nx.dev/ci/features/flaky-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

### Step 2

Use the following command to configure a CI workflow for your workspace:

```sh
npx nx g ci-workflow
```

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/node?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)


## Workflow runtime

The backend uses the official `@workflow/nest` module with `@workflow/world-postgres`.
Before starting it, bootstrap the SDK storage with the same environment:

```sh
node --env-file-if-exists=.env node_modules/@workflow/world-postgres/bin/setup.js
pnpm nx build @zuko/backend
pnpm nx serve @zuko/backend
```

`WORKFLOW_POSTGRES_URL` defaults to `DATABASE_URL`. SDK-owned tables live in the
`workflow` and `graphile_worker` schemas. Use a dedicated store per environment,
or distinct `WORKFLOW_QUEUE_NAMESPACE` values when sharing one.

Author workflows under `apps/backend/src/workflows/`; Nx discovers and bundles
this directory automatically. Rebuild and restart the backend after changes.
The runtime registers private in-process delivery before starting workers and
rejects public HTTP access to the SDK execution routes. Nest owns worker startup
and shutdown. Organization setup uses this runtime as described below.

Set `WORKFLOW_POSTGRES_JOB_LOCK_STALE_SECONDS=30` consistently across replicas and
size `WORKFLOW_POSTGRES_WORKER_CONCURRENCY` for the database pool. Persist the SDK
store across restarts. Runtime dependencies are packaged by `nx prune` for Docker.
Keep SDK package versions coordinated when upgrading.

Use the SDK admin UI to inspect runs, with workers disabled in the admin process:

```sh
WORKFLOW_POSTGRES_SKIP_WORKERS=1 node --env-file-if-exists=.env node_modules/workflow/bin/run.js web --backend @workflow/world-postgres --webPort 4400
```


## Organization setup

Better Auth creates the organization, then attaches a separate durable setup workflow.
It provisions Contacts, Companies, Deals, fields, and relationships. The setup screen
shows the organization name and streams a checklist timeline through Next.js; completion
stays visible until the user chooses **Go to dashboard**. Other pages reuse a cached
readiness snapshot checked when selecting an organization; incomplete setup shows a
banner rather than replacing unrelated page content. Chat waits for readiness.

Apply the Prisma migrations before starting the backend. They add tenant-scoped setup
state and queue existing organizations. A reconciler attaches runs to organizations
missing a run reference after crashes. CRM HTTP, MCP, and Eve access wait for readiness;
visiting a records page never creates schema.

Provisioning preserves existing standard objects and customizations. A custom object
occupying a required CRM key fails the transaction without overwriting it. Transient
provisioning errors receive five SDK retries with capped exponential backoff. Resolve
permanent conflicts before using the SDK admin UI to re-run setup. Re-runs create a new
SDK run for the same organization and update its server-owned `setupRunId`; refresh the
setup page to follow that new run.

The authenticated Next.js route `/api/organizations/:id/setup` checks organization
membership through Better Auth and reads that run's persisted stream without polling.
Next.js needs the same workflow store as Nest and starts no workers. There is no status polling
or application retry API. Eve's local development world remains separate.

Add future repeat-safe setup steps to `apps/backend/src/workflows/organization-setup.ts`
before `markReady`. Earlier committed steps survive a later failure; organization
creation is outside the workflow. Persist the SDK store and follow SDK versioning
guidance when deploying changed workflow definitions with unfinished runs.


## Frontend access

Next.js pages and API routes require a valid Better Auth session by default through
`apps/app/src/proxy.ts`. Anonymous page requests redirect to login with their return
path; API requests return 401. Cookie presence alone is not trusted. Backend session
validation failures return 503 rather than allowing access.

The explicit public allowlist contains login, signup, consent and invitation landing
pages, and application icons. Next.js static/image/HMR assets bypass the proxy. Eve's
`/eve/v1/` protocol routes retain their own bearer-token/callback authentication.
Membership and permissions are still enforced by the backend.

While a setup run is not attached yet, the setup page stays pending and EventSource
reconnects until reconciliation attaches it. Failed setup refreshes replay the SDK's
persisted failure event, retaining the failed step and completed earlier steps.
