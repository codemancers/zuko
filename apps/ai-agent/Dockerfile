# Build from the repo root:
#   docker build -f apps/ai-agent/Dockerfile -t zuko-ai-agent .
#
FROM node:24-bullseye-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    rm -rf /var/lib/apt/lists/*
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app

# The app has no @zuko/* workspace deps, so it installs standalone.
COPY apps/ai-agent/package.json ./
RUN bun install

COPY apps/ai-agent/ ./
# eve build emits a self-contained nitro server at .output/
RUN bunx eve build


FROM node:24-bullseye-slim AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3002
# Self-registered agent credentials persist here — mount a volume, or provide
# ZUKO_AGENT_ID / ZUKO_AGENT_PRIVATE_JWK instead.
ENV ZUKO_AGENT_STATE_DIR=/data

WORKDIR /app
COPY --from=build /app/.output ./.output
RUN mkdir -p /data

VOLUME /data
EXPOSE 3002

CMD ["node", ".output/server/index.mjs"]
