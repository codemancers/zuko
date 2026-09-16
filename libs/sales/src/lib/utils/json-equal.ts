/**
 * Structural equality for JSON-shaped values (e.g. Prisma Json columns).
 *
 * Postgres jsonb does not preserve object key order on round-trip, so a value
 * read back from the DB can have different key order than the value that was
 * written even when semantically identical. A plain `JSON.stringify` compare
 * would treat that as a change; this sorts object keys (recursively, arrays
 * keep their order since element order is meaningful) before comparing.
 */
function stableStringify(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );
  return `{${entries.join(',')}}`;
}

export function jsonEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}
