import * as z from 'zod';

/** The largest value a bigint column holds (2^63 - 1). */
export const MAX_ID = 9223372036854775807n;

const DIGITS = /^[1-9]\d{0,18}$/;

/**
 * An id as the API speaks it (a string of digits, or a whole number) as a bigint, or undefined when it
 * is not a positive id that fits a bigint column. Nineteen digits can be larger than the column holds,
 * and such a value would otherwise reach the database and come back as a server error.
 */
export function parseId(raw: unknown): bigint | undefined {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw > 0 ? BigInt(raw) : undefined;
  }
  if (typeof raw === 'string' && DIGITS.test(raw)) {
    const id = BigInt(raw);
    return id <= MAX_ID ? id : undefined;
  }
  return undefined;
}

/** A request field holding an id: validated, and turned into a bigint. */
export const idField = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const id = parseId(value);
  if (id === undefined) {
    ctx.addIssue({ code: 'custom', message: 'must be a numeric id' });
    return z.NEVER;
  }
  return id;
});
