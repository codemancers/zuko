import { BadRequestException } from '@nestjs/common';

// Task due dates are calendar days (Postgres DATE), exchanged as YYYY-MM-DD.
// Prisma represents a DATE as a JS Date at UTC midnight, so conversions here
// use UTC fields only and never the process time zone.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** UTC midnight of a calendar day, or null if the day does not exist. */
function utcMidnight(value: string): Date | null {
  const match = DATE_ONLY.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1) return null;
  // Date.UTC maps years 0-99 to 1900-1999; setUTCFullYear does not.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  // Out-of-range parts roll over (Feb 30 -> Mar 2), so a mismatch means the
  // day is not on the calendar.
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

/** True for a real calendar day written as YYYY-MM-DD in 0001..9999. */
export function isDueDateString(value: unknown): value is string {
  return typeof value === 'string' && utcMidnight(value) !== null;
}

/**
 * Converts due-date input to the Prisma column value: undefined (omitted,
 * leave the column alone), null (clear) or a UTC-midnight Date.
 */
export function toDueDateColumn(value: unknown): Date | null | undefined {
  if (value === undefined || value === null) return value;
  const date = typeof value === 'string' ? utcMidnight(value) : null;
  if (!date) {
    throw new BadRequestException(
      'dueDate must be a calendar date in YYYY-MM-DD format or null',
    );
  }
  return date;
}

/** Formats a UTC-midnight DATE value as YYYY-MM-DD. */
export function formatDueDate(date: Date): string {
  const pad = (n: number, width: number) => String(n).padStart(width, '0');
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

type DateOnly<T> = T extends { dueDate: Date | null }
  ? Omit<T, 'dueDate'> & { dueDate: string | null }
  : T;

export type WithDateOnlyDueDates<T> = T extends { subtasks: (infer S)[] }
  ? Omit<DateOnly<T>, 'subtasks'> & { subtasks: DateOnly<S>[] }
  : DateOnly<T>;

function serializeOne<T extends object>(row: T): DateOnly<T> {
  if (!('dueDate' in row) || !(row.dueDate instanceof Date)) {
    return row as DateOnly<T>;
  }
  return { ...row, dueDate: formatDueDate(row.dueDate) } as DateOnly<T>;
}

/** Replaces a task's (and its returned subtasks') dueDate with YYYY-MM-DD. */
export function serializeTaskDueDates<T extends object>(
  task: T,
): WithDateOnlyDueDates<T> {
  const result = serializeOne(task) as Record<string, unknown>;
  if (Array.isArray(result.subtasks)) {
    result.subtasks = result.subtasks.map((subtask: object) =>
      serializeOne(subtask),
    );
  }
  return result as WithDateOnlyDueDates<T>;
}
