import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../../prisma/prisma.service';
import { buildMcpServer } from './mcp-server';
import { McpBearerGuard, type McpAuthedRequest } from './mcp-bearer.guard';

/**
 * MCP endpoint (Streamable HTTP, stateless) protected by OAuth bearer tokens
 * issued by this backend's @better-auth/oauth-provider plugin. @AllowAnonymous
 * opts this route out of the app's session-cookie guard (AppAuthGuard); the
 * route-scoped McpBearerGuard then verifies the bearer JWT and attaches
 * { userId, scopes } as req.mcpAuth. Only POST does MCP work; GET/DELETE have
 * nothing to resume or delete on a stateless server, so they return 405.
 */
@AllowAnonymous()
@UseGuards(McpBearerGuard)
@Controller('mcp')
export class McpController {
  constructor(private readonly prisma: PrismaService) {}

  @All()
  async handle(@Req() req: McpAuthedRequest, @Res() res: Response) {
    if (req.method !== 'POST') {
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      });
      return;
    }

    // Guaranteed by McpBearerGuard for POST requests.
    const { userId, scopes } = req.mcpAuth!;

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
}
