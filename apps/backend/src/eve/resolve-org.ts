import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

/**
 * Derive the orgId for an eve proxy request.
 *
 * The canonical pattern in this codebase is the `x-org-id` header
 * (set by the frontend for every org-scoped request, validated by
 * OrganisationGuard).  We read that here directly — no DB round-trip,
 * no Better-Auth-org plugin dependency.  If the header is absent or
 * invalid we throw a BadRequestException (400), matching the behavior
 * of OrganisationGuard, rather than letting an unhandled Error surface
 * as a 500.
 */
export function resolveOrgId(req: Request): number {
  const header = req.headers['x-org-id'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw && /^\d+$/.test(raw)) return Number(raw);
  throw new BadRequestException(
    'eve proxy: could not resolve orgId — x-org-id header missing or invalid',
  );
}
