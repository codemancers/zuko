import { All, Controller, Req, Res } from '@nestjs/common';
import { requireMcpAuth } from '@better-auth/mcp';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { AllowAnonymous, AuthService } from '@thallesp/nestjs-better-auth';
import { CrmContextService, type RequestContext } from '../crm/context';
import { DirectoryService } from '../crm/directory.service';
import { CrmError } from '../crm/errors';
import { RecordsQueryService } from '../crm/records-query.service';
import { RecordsService } from '../crm/records.service';
import { SchemaService } from '../crm/schema.service';
import { BACKEND_URL, MCP_PATH, MCP_RESOURCE, MCP_SCOPES, ORG_CLAIM } from '../libs/better-auth/constants';
import { PrismaService } from '../prisma/prisma.service';
import { sendFetchResponse, toFetchRequest, type HttpRequest, type HttpResponse } from './http';
import { buildMcpServer } from './mcp-tools';

const problem = (status: number, code: string, message: string) =>
  new Response(JSON.stringify({ code, message }), { status, headers: { 'content-type': 'application/json' } });

/** A token that is still signed and unexpired, but whose connection the user has disconnected. */
const disconnected = () =>
  new Response(JSON.stringify({ code: 'CONNECTION_REVOKED', message: 'This connection was disconnected; connect again' }), {
    status: 401,
    headers: {
      'content-type': 'application/json',
      'www-authenticate': `Bearer error="invalid_token", error_description="connection disconnected", resource_metadata="${BACKEND_URL}/.well-known/oauth-protected-resource${MCP_PATH}"`,
    },
  });

/**
 * The MCP endpoint. It is not behind the web-session guard: access is by OAuth access
 * token only. A token carries the user (`sub`) and the organization they chose when they
 * connected; the request then runs as that user in that organization.
 */
@Controller('mcp')
export class McpController {
  private readonly handler;

  constructor(
    private readonly auth: AuthService,
    private readonly contexts: CrmContextService,
    private readonly prisma: PrismaService,
    schema: SchemaService,
    records: RecordsService,
    queries: RecordsQueryService,
    directory: DirectoryService,
  ) {
    // One server per request, built for the caller handed over in authInfo. Both the
    // 2026-07-28 protocol and the earlier stateless one are served, so existing clients work.
    this.handler = createMcpHandler(({ authInfo }) => {
      const { ctx } = (authInfo?.extra ?? {}) as { ctx?: RequestContext };
      if (!ctx) {
        throw new Error('MCP request reached the server without a caller');
      }
      return buildMcpServer({ schema, records, queries, directory }, ctx, new Set(authInfo?.scopes ?? []));
    });
  }

  @All()
  @AllowAnonymous()
  async handle(@Req() req: HttpRequest, @Res() res: HttpResponse) {
    const guarded = requireMcpAuth(
      this.auth.instance,
      async (request, claims) => {
        const organizationId = claims[ORG_CLAIM];
        if (typeof claims.sub !== 'string' || typeof organizationId !== 'string') {
          return problem(403, 'NO_ORGANIZATION', 'This connection is not bound to an organization; reconnect it');
        }

        // Access tokens are valid until they expire, so disconnecting is enforced here: the
        // approval the token was issued under must still exist.
        const approved = await this.prisma.oauthConsent.findFirst({
          where: { userId: BigInt(claims.sub), clientId: String(claims.azp ?? ''), referenceId: organizationId },
          select: { id: true },
        });
        if (!approved) {
          return disconnected();
        }

        let ctx: RequestContext;
        try {
          ctx = await this.contexts.build({
            userId: BigInt(claims.sub),
            organizationId: BigInt(organizationId),
            actorType: 'MCP',
            requestId: request.headers.get('x-request-id') ?? undefined,
          });
        } catch (error) {
          if (error instanceof CrmError) {
            return problem(403, error.code, error.message); // e.g. removed from the organization since connecting
          }
          throw error;
        }

        return this.handler.fetch(request, {
          parsedBody: req.method === 'POST' ? req.body : undefined,
          authInfo: {
            token: '',
            clientId: String(claims.azp ?? ''),
            scopes: String(claims.scope ?? '')
              .split(' ')
              .filter(Boolean),
            ...(typeof claims.exp === 'number' ? { expiresAt: claims.exp } : {}),
            extra: { ctx },
          },
        });
      },
      { resource: MCP_RESOURCE, requiredScopes: [MCP_SCOPES.read] },
    );

    await sendFetchResponse(res, await guarded(toFetchRequest(req)));
  }
}
