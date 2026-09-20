# Build the docker image with `pnpm exec nx docker:build @zuko/backend`.
# This expects the build output from `pnpm exec nx run @zuko/backend:build` and `pnpm exec nx run @zuko/backend:prune`
#
FROM node:24-bullseye AS base

RUN apt-get update && apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && corepack prepare pnpm@11.26.0 --activate

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

WORKDIR /app

# Copy the entire dist folder which includes:
# - main.js (bundled application)
# - package.json (pruned dependencies)
# - workspace_modules (internal workspace dependencies including @zuko/models with prisma schemas)
COPY apps/backend/dist .

EXPOSE 3001

# Install production dependencies. dist/package.json has every version pinned
# exactly by the pin-dist-versions target, so this resolves deterministically
# without a lockfile, and the dist/pnpm-workspace.yaml that prune-lockfile emits
# carries the workspace's build-script approvals (@prisma/engines needs one).
# --node-linker=hoisted keeps the flat node_modules layout the bundle resolves
# against.
RUN pnpm install --prod --node-linker=hoisted

# Copy multi-file prisma schemas (not included by copy-workspace-modules)
COPY libs/models/prisma ./workspace_modules/@zuko/models/prisma

# Generate Prisma Client from the schemas in workspace_modules/@zuko/models/prisma
# Point to directory for multi-file schema support
# Use dummy DATABASE_URL since generate doesn't connect to database
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    pnpm exec prisma generate --schema=./workspace_modules/@zuko/models/prisma

CMD [ "node", "main.js" ]
