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
and shutdown. This infrastructure does not change organization creation or CRM setup.

Set `WORKFLOW_POSTGRES_JOB_LOCK_STALE_SECONDS=30` consistently across replicas and
size `WORKFLOW_POSTGRES_WORKER_CONCURRENCY` for the database pool. Persist the SDK
store across restarts. Runtime dependencies are packaged by `nx prune` for Docker.
Keep SDK package versions coordinated when upgrading.

Use the SDK admin UI to inspect runs, with workers disabled in the admin process:

```sh
WORKFLOW_POSTGRES_SKIP_WORKERS=1 node --env-file-if-exists=.env node_modules/workflow/bin/run.js web --backend @workflow/world-postgres --webPort 4400
```
