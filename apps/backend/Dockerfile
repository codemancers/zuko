# Build the docker image with `bunx nx docker:build @zuko/backend`.
# This expects the build output from `bunx nx run @zuko/backend:build` and `bunx nx run @zuko/backend:prune`
#
FROM oven/bun:1.3.10-alpine AS base

# Install openssl for Prisma and build tools for potential native modules
RUN apk add --no-cache openssl

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

# Install production dependencies using Bun
RUN bun install --production

# Generate Prisma Client from the schemas in workspace_modules/@zuko/models/prisma
# Point to directory (not file) for multi-file schema support
# Use dummy DATABASE_URL since generate doesn't connect to database
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    bunx prisma generate --config=./workspace_modules/@zuko/models/prisma.config.ts

CMD [ "bun", "run", "main.js" ]
