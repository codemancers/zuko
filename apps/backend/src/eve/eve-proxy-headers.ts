import { signEvePrincipal } from '../utils/eve-principal';

const STRIP = new Set([
  'cookie',
  'authorization',
  'host',
  'content-length',
  'connection',
  'x-eve-principal',
]);

export function buildUpstreamHeaders(
  incoming: Record<string, string | string[] | undefined>,
  principal: { userId: number; orgId: number },
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (v === undefined || STRIP.has(k.toLowerCase())) continue;
    out[k] = Array.isArray(v) ? v.join(',') : v;
  }
  out['x-eve-principal'] = signEvePrincipal(principal);
  return out;
}
