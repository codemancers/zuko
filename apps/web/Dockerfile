# syntax=docker.io/docker/dockerfile:1

FROM oven/bun:1.3.10-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy pre-built Next.js standalone output
# The build happens outside Docker via: npx nx build @zuko/web
COPY --chown=nextjs:nodejs apps/web/.next/standalone ./
COPY --chown=nextjs:nodejs apps/web/.next/static ./apps/web/.next/static
COPY --chown=nextjs:nodejs apps/web/public ./apps/web/public

# Switch to non-root user
USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# The standalone build creates a server.js
CMD ["bun", "run", "apps/web/server.js"]
