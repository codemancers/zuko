import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { verifyAccessToken } from 'better-auth/oauth2';
import { PrismaService } from '../../prisma/prisma.service';
import { buildMcpServer } from './mcp-server';

const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:8000';
const issuer = `${baseURL}/auth`;
const resource = `${baseURL}/api/mcp`;
const resourceMetadataUrl = `${baseURL}/.well-known/oauth-protected-resource/api/mcp`;

/**
 * MCP endpoint (Streamable HTTP, stateless) protected by OAuth bearer
 * tokens issued by this backend's @better-auth/oauth-provider plugin.
 * Tokens are JWTs (clients request them with resource=${resource} per
 * RFC 8707) verified locally against our own JWKS. A 401 carries the
 * WWW-Authenticate header that triggers MCP clients' OAuth discovery.
 */
@Controller('mcp')
export class McpController {
  constructor(private readonly prisma: PrismaService) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response) {
    if (req.method !== 'POST') {
      // Stateless server: no SSE streams to resume (GET) or sessions to
      // delete (DELETE).
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      });
      return;
    }

    const authorization = req.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    if (!token) {
      return this.unauthorized(res, 'Missing bearer token');
    }

    let userId: number;
    let scopes: string[];
    try {
      const payload = await verifyAccessToken(token, {
        jwksUrl: `${issuer}/jwks`,
        verifyOptions: { issuer, audience: resource },
      });
      userId = Number(payload.sub);
      scopes =
        typeof payload.scope === 'string' ? payload.scope.split(' ') : [];
      if (!Number.isInteger(userId)) {
        return this.unauthorized(res, 'Token subject is not a user');
      }
    } catch {
      return this.unauthorized(res, 'Invalid or expired access token');
    }

    const server = buildMcpServer(this.prisma, { userId, scopes });
    const transport = new StreamableHTTPServerTransport({
      // Stateless: a fresh server+transport per request, no session ids.
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }

  private unauthorized(res: Response, description: string) {
    res
      .status(401)
      .set(
        'WWW-Authenticate',
        `Bearer resource_metadata="${resourceMetadataUrl}", error="invalid_token", error_description="${description}"`,
      )
      .json({
        jsonrpc: '2.0',
        error: { code: -32001, message: `Unauthorized: ${description}` },
        id: null,
      });
  }
}
