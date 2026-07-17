import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { EveTargetService } from './eve-target.service';
import { buildUpstreamHeaders } from './eve-proxy-headers';

@Injectable()
export class EveProxyService {
  private readonly logger = new Logger(EveProxyService.name);

  constructor(
    private readonly eve: EveTargetService,
    private readonly db: PrismaService,
  ) {}

  async verifyOrgMembership(userId: number, orgId: number): Promise<void> {
    const member = await this.db.member.findFirst({
      where: { userId, organizationId: orgId },
    });
    if (!member) {
      throw new ForbiddenException('User does not belong to this organisation');
    }
  }

  async proxy(
    req: ExpressRequest,
    res: ExpressResponse,
    principal: { userId: number; orgId: number },
  ): Promise<void> {
    const upstreamPath = req.originalUrl.replace(/^\/api/, '');
    const url = `${this.eve.baseUrl}${upstreamPath}`;
    const controller = new AbortController();
    res.on('close', () => controller.abort());

    const hasBody = !['GET', 'HEAD'].includes(req.method.toUpperCase());
    const body = hasBody ? await recoverRequestBody(req) : undefined;

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        method: req.method,
        headers: buildUpstreamHeaders(
          req.headers as Record<string, string | string[]>,
          principal,
        ),
        body: body as Buffer | string | undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      this.logger.error(`eve proxy fetch error: ${String(err)}`);
      if (!res.headersSent) res.status(502).json({ error: 'eve upstream unavailable' });
      return;
    }

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'content-length') return;
      if (key.toLowerCase() === 'set-cookie') return;
      res.setHeader(key, value);
    });

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

  if (!req.readableDidRead) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  }
  return undefined;
}
