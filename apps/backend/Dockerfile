# Build the docker image with `npx nx docker:build @zuko/backend`.
# This expects the build output from `npx nx run @zuko/backend:build` and `npx nx run @zuko/backend:prune`
#
FROM docker.io/node:lts-alpine

# Install git for repository cloning
RUN apk add --no-cache git

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

WORKDIR /app

# Copy the entire dist folder which includes:
# - main.js (bundled application)
# - package.json and package-lock.json (pruned dependencies)
# - workspace_modules (internal workspace dependencies including @zuko/models with prisma schemas)
COPY apps/backend/dist .

# Install production dependencies
# This includes @prisma/client and prisma CLI
RUN npm --omit=dev -f install

# Generate Prisma Client from the schemas in workspace_modules/@zuko/models/prisma
# Point to directory (not file) for multi-file schema support
# Use dummy DATABASE_URL since generate doesn't connect to database
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
    npx prisma generate --config=./workspace_modules/@zuko/models/prisma.config.ts


CMD [ "node", "main.js" ]
