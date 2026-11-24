# Build from the repository root:
#   docker build -f apps/connect/Dockerfile -t zuko-connect .
FROM node:22-slim AS build

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /repo

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/connect/package.json apps/connect/
RUN pnpm install --frozen-lockfile --filter @zuko/connect...

COPY apps/connect apps/connect
RUN pnpm deploy --legacy --filter @zuko/connect --prod /app

FROM node:22-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /app
COPY --from=build /app /app

ENV NODE_ENV=production
ENV PATH="/app/node_modules/.bin:$PATH"

EXPOSE 3333

CMD ["sh", "-c", "kosha migrate deploy && exec kosha start"]
