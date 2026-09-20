# Build from the repo root:
#   docker build -f apps/harness/Dockerfile -t zuko-ai-agent .
#
FROM node:24-bullseye-slim AS build

RUN corepack enable && corepack prepare pnpm@11.26.0 --activate

WORKDIR /app

# The app has no @zuko/* workspace deps, so it installs standalone. pnpm
# refuses to run dependency build scripts unless they are approved; inside a
# throwaway image built from this manifest, running them all is what bun did.
COPY apps/harness/package.json ./
RUN printf 'dangerouslyAllowAllBuilds: true\n' > pnpm-workspace.yaml && \
    pnpm install

COPY apps/harness/ ./
# eve build emits a self-contained nitro server at .output/
RUN pnpm exec eve build


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
