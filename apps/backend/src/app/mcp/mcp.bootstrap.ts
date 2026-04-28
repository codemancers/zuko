import type { INestApplication } from '@nestjs/common';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { mcpAuthOfficial } from 'better-auth/plugins/mcp/client/adapters';
import { createMcpAuthClient } from 'better-auth/plugins/mcp/client';
import { McpService } from './mcp.service';

/** Convert an Express request to a Web Standard Request. */
function toWebRequest(req: ExpressRequest, port: number): Request {
  const url = `http://localhost:${port}${req.url}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody
    ? new ReadableStream<Uint8Array>({
        start(controller) {
          req.on('data', (chunk: Buffer) =>
            controller.enqueue(new Uint8Array(chunk)),
          );
          req.on('end', () => controller.close());
          req.on('error', (err) => controller.error(err));
        },
      })
    : null;
  return new Request(url, {
    method: req.method,
    headers,
    body,
    // `duplex` is a Node.js extension to RequestInit required for streaming request bodies.
    // It is not in TypeScript's DOM lib types, hence the cast.
    duplex: 'half',
  } as RequestInit);
}

/** Pipe a Web Standard Response back to an Express response. */
async function writeWebResponse(
  webRes: Response,
  res: ExpressResponse,
): Promise<void> {
  res.status(webRes.status);
  webRes.headers.forEach((value, key) => res.setHeader(key, value));
  if (webRes.body) {
    const reader = webRes.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  res.end();
}

/**
 * Registers MCP-related Express routes on the underlying adapter.
 * Called once during bootstrap after NestJS app creation.
 *
 * ⚠️  IMPORTANT: These routes are registered directly on the Express instance and
 * therefore bypass NestJS's global guards, interceptors, pipes, and exception
 * filters. This is an intentional trade-off — MCP requires raw Web Standard
 * Request/Response handling, which is incompatible with NestJS's decorator-based
 * middleware pipeline.
 *
 * Authentication is handled by `mcpAuthOfficial` (Remote MCP Client adapter from
 * better-auth) which validates the OAuth bearer token via HTTP against the auth
 * server. This avoids importing the `auth` instance directly, which would cause
 * TS4023 due to better-auth's unexported `MCPOptions` type.
 *
 * Routes registered:
 *  GET  /.well-known/oauth-authorization-server  — OAuth discovery
 *  GET  /.well-known/oauth-protected-resource    — Resource metadata
 *  ALL  /api/mcp                                 — MCP Streamable HTTP endpoint
 */
export function registerMcpRoutes(app: INestApplication, port: number): void {
  const mcpService = app.get(McpService);
  const expressApp = app.getHttpAdapter().getInstance();

  const authURL =
    process.env.NODE_ENV === 'production'
      ? `${process.env.BACKEND_URL || `http://localhost:${port}`}/auth`
      : `http://localhost:${port}/auth`;

  const mcpAuth = mcpAuthOfficial({ authURL });
  const mcpAuthBase = createMcpAuthClient({ authURL });

  const discoveryHandler = mcpAuthBase.discoveryHandler();
  const protectedResourceHandler = mcpAuthBase.protectedResourceHandler(
    `http://localhost:${port}`,
  );

  expressApp.get(
    '/.well-known/oauth-authorization-server',
    async (req: ExpressRequest, res: ExpressResponse) => {
      const webRes = await discoveryHandler(toWebRequest(req, port));
      await writeWebResponse(webRes, res);
    },
  );

  expressApp.get(
    '/.well-known/oauth-protected-resource',
    async (req: ExpressRequest, res: ExpressResponse) => {
      const webRes = await protectedResourceHandler(toWebRequest(req, port));
      await writeWebResponse(webRes, res);
    },
  );

  const mcpHandler = mcpAuth.handler(async (webReq, session) => {
    const userId = Number(session.userId);
    try {
      const organizationId = await mcpService.resolveOrganizationId(userId);
      return mcpService.handleRequest(webReq, organizationId, userId);
    } catch {
      return new Response(
        JSON.stringify({ error: 'User has no associated organization' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }
  });

  expressApp.all(
    '/api/mcp',
    async (req: ExpressRequest, res: ExpressResponse) => {
      try {
        const webRes = await mcpHandler(toWebRequest(req, port));
        await writeWebResponse(webRes, res);
      } catch {
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    },
  );
}
