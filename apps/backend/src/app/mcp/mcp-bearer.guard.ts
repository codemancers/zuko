import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { verifyAccessToken } from 'better-auth/oauth2';

// Must match better-auth's baseURL (auth.ts) and the well-known controller so
// the token's issuer/audience and the JWKS URL all resolve to the same origin.
const baseURL = process.env.BACKEND_URL || 'http://localhost:3001';
const issuer = `${baseURL}/auth`;
const resource = `${baseURL}/api/mcp`;
const resourceMetadataUrl = `${baseURL}/.well-known/oauth-protected-resource/api/mcp`;

/** Auth context the guard attaches to the request for the MCP controller. */
export interface McpAuth {
  userId: number;
  scopes: string[];
}

export type McpAuthedRequest = Request & { mcpAuth?: McpAuth };

/**
 * Authenticates MCP requests with the OAuth 2.1 bearer tokens this backend
 * issues (JWTs verified locally against our JWKS). This is the MCP endpoint's
 * own auth scheme — distinct from the app's session-cookie AppAuthGuard, which
 * the controller opts out of via @AllowAnonymous().
 *
 * On success it attaches { userId, scopes } as `request.mcpAuth`. On failure it
 * emits the RFC 9728 challenge (a WWW-Authenticate header pointing at the
 * protected-resource metadata) inside a JSON-RPC error body, which is what
 * drives MCP clients' OAuth discovery — a generic 401 would not.
 *
 * Non-POST requests are passed through untouched: the stateless server has no
 * SSE streams to resume (GET) or sessions to delete (DELETE), so the controller
 * answers those with 405 without requiring a token.
 */
@Injectable()
export class McpBearerGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<McpAuthedRequest>();
    const res = context.switchToHttp().getResponse<Response>();

    if (req.method !== 'POST') {
      return true;
    }

    const authorization = req.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    if (!token) {
      this.challenge(res, 'Missing bearer token');
    }

    let payload: Awaited<ReturnType<typeof verifyAccessToken>> | null = null;
    try {
      payload = await verifyAccessToken(token, {
        jwksUrl: `${issuer}/jwks`,
        verifyOptions: { issuer, audience: resource },
      });
    } catch {
      payload = null;
    }
    if (!payload) {
      this.challenge(res, 'Invalid or expired access token');
    }

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId)) {
      this.challenge(res, 'Token subject is not a user');
    }

    req.mcpAuth = {
      userId,
      scopes: typeof payload.scope === 'string' ? payload.scope.split(' ') : [],
    };
    return true;
  }

  /** Sends the RFC 9728 bearer challenge as a JSON-RPC 401. Never returns. */
  private challenge(res: Response, description: string): never {
    res.setHeader(
      'WWW-Authenticate',
      `Bearer resource_metadata="${resourceMetadataUrl}", error="invalid_token", error_description="${description}"`,
    );
    throw new HttpException(
      {
        jsonrpc: '2.0',
        error: { code: -32001, message: `Unauthorized: ${description}` },
        id: null,
      },
      HttpStatus.UNAUTHORIZED,
    );
  }
}
