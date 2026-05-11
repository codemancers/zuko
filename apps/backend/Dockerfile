# Build the docker image with `bunx nx docker:build @zuko/backend`.
# This expects the build output from `bunx nx run @zuko/backend:build` and `bunx nx run @zuko/backend:prune`
#
FROM node:24-bullseye AS base

RUN apt-get update && apt-get install -y openssl curl && \
    curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

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

# Install production dependencies using bun
RUN bun install --production

# Copy multi-file prisma schemas (not included by copy-workspace-modules)
COPY libs/models/prisma ./workspace_modules/@zuko/models/prisma

# Generate Prisma Client from the schemas in workspace_modules/@zuko/models/prisma
# Point to directory for multi-file schema support
# Use dummy DATABASE_URL since generate doesn't connect to database
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    bunx prisma generate --schema=./workspace_modules/@zuko/models/prisma

CMD [ "node", "main.js" ]
