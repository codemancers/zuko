const FALLBACK = '/dashboard';

/**
 * Validates a `?next=` redirect target so a crafted link can't send people off-site.
 * Only same-site absolute paths pass. Backslashes are rejected too, because browsers
 * read `/\evil.com` as `//evil.com`.
 */
export function safeNextPath(next: string | null | undefined, fallback = FALLBACK) {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }
  return next;
}
