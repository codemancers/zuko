import {
  All,
  Controller,
  ForbiddenException,
  Inject,
  Logger,
  Req,
  Res,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { PrismaService } from '../prisma/prisma.service';
import { EveTargetService } from './eve-target.service';
import { resolveOrgId } from './resolve-org';
import { buildUpstreamHeaders } from './eve-proxy-headers';
import { auth } from '../libs/better-auth/auth';

export { buildUpstreamHeaders } from './eve-proxy-headers';

/**
 * Catch-all reverse proxy for `/eve/v1/*`.
 *
 * Security invariants:
 *  - 401 if no Better Auth session (global AppAuthGuard would also fire, but
 *    we @AllowAnonymous() so we own the 401 response ourselves for clarity).
 *  - cookie / authorization NEVER forwarded to eve (stripped by buildUpstreamHeaders).
 *  - Identity forwarded as a short-lived HMAC-signed x-eve-principal token.
 *  - Org membership verified against DB before principal is signed (prevents
 *    cross-tenant IDOR: user cannot forge a principal for an org they don't
 *    belong to by supplying a different x-org-id header).
 *
 * Streaming:
 *  - Client disconnect → AbortController.abort() cancels the upstream fetch.
 *  - Upstream response body piped chunk-by-chunk without buffering (NDJSON
 *    `/stream` endpoints work live).
 *  - content-length dropped from upstream response so browsers don't complain
 *    about mismatches caused by hop-by-hop encoding differences.
 *  - set-cookie NEVER relayed from upstream to the browser (cross-tenant
 *    trust boundary — eve's cookies are not this client's to receive).
 *
 * Request body:
 *  - body-parser is bypassed for /eve/v1/* (see configureBodyParsing in
 *    body-parser.ts), so the Express req is still a raw readable stream.
 *  - The stream is buffered before the upstream fetch (see readRawBody) —
 *    bodies are small JSON because the eve channel disables uploads.
 */
@AllowAnonymous()
@Controller('eve/v1')
export class EveProxyController {
  private readonly logger = new Logger(EveProxyController.name);

  constructor(
    @Inject(EveTargetService) private readonly eve: EveTargetService,
    @Inject(PrismaService) private readonly databaseService: PrismaService,
  ) {}

  @All('*')
  async proxy(
    @Req() req: ExpressRequest,
    @Res() res: ExpressResponse,
  ): Promise<void> {
    // --- Auth (Pattern-2) ---
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user?.id) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }

    const userId = Number(session.user.id);
    if (!Number.isFinite(userId)) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    const orgId = resolveOrgId(req);

    // --- Org membership check (replicates OrganisationGuard — same table/query) ---
    // Prevent cross-tenant IDOR: the authenticated user MUST be a member of
    // the requested org before we sign it into x-eve-principal.
    const member = await this.databaseService.member.findFirst({
      where: { userId, organizationId: orgId },
    });
    if (!member) {
      throw new ForbiddenException('User does not belong to this organisation');
    }

    // --- Upstream fetch with AbortController for client-disconnect propagation ---
    const upstreamPath = req.originalUrl.replace(/^\/api/, '');
    const url = `${this.eve.baseUrl}${upstreamPath}`;
    const controller = new AbortController();
    res.on('close', () => controller.abort());

    const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase());

    // Recover the request body as a Buffer/string, wherever it ended up.
    // Our configureBodyParsing bypasses /eve/v1/*, but
    // @thallesp/nestjs-better-auth registers its OWN global express.json()
    // (enabled by default), which consumes the stream after our bypass —
    // streaming req into fetch then fails under undici with "Response body
    // object should not be disturbed or locked", and a raw re-read yields
    // an empty body (both verified against a live eve dev server; the
    // exploration branch missed this because its tests mock fetch). So:
    // prefer the saved rawBody, then the parsed req.body (re-serialized —
    // safe, eve verifies the principal header, not body bytes), and only
    // fall back to reading the stream. Buffering is fine: the eve channel
    // disables uploads, so bodies are small JSON. Response-side NDJSON
    // streaming is unaffected.
    const body = hasBody ? await recoverRequestBody(req) : undefined;

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: req.method,
        headers: buildUpstreamHeaders(
          req.headers as Record<string, string | string[]>,
          { userId, orgId },
        ),
        body: body as Buffer | string | undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        // Client disconnected before upstream responded — nothing to write.
        return;
      }
      this.logger.error(`eve proxy fetch error: ${String(err)}`);
      if (!res.headersSent) {
        res.status(502).json({ error: 'eve upstream unavailable' });
      }
      return;
    }

    // --- Forward response status + headers ---
    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      // Drop content-length: the streaming pipe may deliver different byte
      // counts than what the upstream declared (e.g. gzip decompression).
      if (key.toLowerCase() === 'content-length') return;
      // Drop set-cookie: a cross-tenant proxy must never relay an upstream
      // cookie to the browser (trust-boundary hardening).
      if (key.toLowerCase() === 'set-cookie') return;
      res.setHeader(key, value);
    });

    // --- Stream body to client ---
    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        this.logger.error(`eve proxy stream error: ${String(err)}`);
      }
    } finally {
      res.end();
    }
  }
}

async function recoverRequestBody(
  req: ExpressRequest,
): Promise<Buffer | string | undefined> {
  const rawBody = (req as ExpressRequest & { rawBody?: Buffer }).rawBody;
  if (rawBody?.length) return rawBody;

  const parsed = (req as ExpressRequest & { body?: unknown }).body;
  if (Buffer.isBuffer(parsed) && parsed.length > 0) return parsed;
  if (typeof parsed === 'string' && parsed.length > 0) return parsed;
  if (
    parsed !== undefined &&
    parsed !== null &&
    typeof parsed === 'object' &&
    Object.keys(parsed).length > 0
  ) {
    return JSON.stringify(parsed);
  }

  // Stream untouched (no middleware consumed it) — read it ourselves.
  if (!req.readableDidRead) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }
  return undefined;
}
