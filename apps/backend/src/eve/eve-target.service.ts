import { Injectable } from '@nestjs/common';

/**
 * Resolves the ai-agent (eve) upstream for the reverse proxy.
 *
 * Eve runs as a SEPARATE deployment (apps/ai-agent): in prod `EVE_BASE_URL`
 * points at its Fly private address (e.g. http://zuko-ai-agent.flycast),
 * in dev at a locally running `eve dev` server. This replaces the
 * exploration branch's in-process EveSupervisorService — spawning eve as a
 * backend child inherited DATABASE_URL and let eve's workflow worker steal
 * backend chat jobs from the shared queue (zuko-6msv).
 */
@Injectable()
export class EveTargetService {
  readonly baseUrl = process.env['EVE_BASE_URL'] ?? 'http://127.0.0.1:2100';
}
