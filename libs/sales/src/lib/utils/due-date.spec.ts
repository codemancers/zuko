import { afterEach, describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import {
  formatDueDate,
  isDueDateString,
  serializeTaskDueDates,
  toDueDateColumn,
} from './due-date';

// Node re-reads process.env.TZ on assignment, so a zone can be pinned per test.
const originalTZ = process.env.TZ;
afterEach(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});

const ZONES = [
  ['UTC', 0],
  ['Asia/Kolkata', -330],
  ['Pacific/Kiritimati', -840],
  ['America/Los_Angeles', 480],
  ['Pacific/Pago_Pago', 660],
] as const;

describe('isDueDateString', () => {
  it.each([
    '2026-11-03',
    '2024-02-29',
    '2000-02-29',
    '0001-01-01',
    '0099-12-31',
    '9999-12-31',
    '2026-01-31',
    '2026-04-30',
  ])('accepts real calendar day %s', (value) => {
    expect(isDueDateString(value)).toBe(true);
  });

  it.each([
    ['', 'empty string'],
    [' 2026-11-03', 'leading space'],
    ['2026-11-03 ', 'trailing space'],
    ['2026-11-3', 'one-digit day'],
    ['26-11-03', 'two-digit year'],
    ['+02026-11-03', 'expanded year'],
    ['0000-01-01', 'year zero'],
    ['10000-01-01', 'five-digit year'],
    ['2026-00-10', 'month zero'],
    ['2026-13-01', 'month 13'],
    ['2026-01-00', 'day zero'],
    ['2026-01-32', 'day 32'],
    ['2026-04-31', 'April 31'],
    ['2026-02-29', 'Feb 29 in a common year'],
    ['1900-02-29', 'Feb 29 in a century common year'],
    ['2026-02-30', 'Feb 30'],
    ['2026-11-03T00:00:00Z', 'UTC timestamp'],
    ['2026-11-03T00:00:00.000Z', 'ISO instant'],
    ['2026-11-03T00:00:00+05:30', 'offset timestamp'],
    ['2026-11-03Z', 'zone suffix'],
    ['2026/11/03', 'slashes'],
    ['20261103', 'basic format'],
    ['not-a-date', 'garbage'],
  ])('rejects %j (%s)', (value) => {
    expect(isDueDateString(value)).toBe(false);
  });

  it.each([
    [20261103],
    [0],
    [true],
    [false],
    [null],
    [undefined],
    [['2026-11-03']],
    [{ date: '2026-11-03' }],
    [new Date('2026-11-03T00:00:00Z')],
  ])('rejects non-string %j', (value) => {
    expect(isDueDateString(value)).toBe(false);
  });
});

describe('toDueDateColumn', () => {
  it('keeps omission and explicit null distinct', () => {
    expect(toDueDateColumn(undefined)).toBeUndefined();
    expect(toDueDateColumn(null)).toBeNull();
  });

  it.each(ZONES)(
    'maps a date-only string to UTC midnight regardless of server zone %s',
    (tz, offset) => {
      process.env.TZ = tz;
      expect(new Date('2026-11-03T12:00:00Z').getTimezoneOffset()).toBe(offset);
      expect(toDueDateColumn('2026-11-03')?.toISOString()).toBe(
        '2026-11-03T00:00:00.000Z',
      );
      expect(toDueDateColumn('2024-02-29')?.toISOString()).toBe(
        '2024-02-29T00:00:00.000Z',
      );
    },
  );

  it.each([
    ['0001-01-01', '0001-01-01T00:00:00.000Z'],
    ['0099-12-31', '0099-12-31T00:00:00.000Z'],
    ['0050-06-15', '0050-06-15T00:00:00.000Z'],
    ['9999-12-31', '9999-12-31T00:00:00.000Z'],
  ])('does not shift JavaScript special years: %s', (value, iso) => {
    expect(toDueDateColumn(value)?.toISOString()).toBe(iso);
  });

  it.each(
    [
      '',
      '2026-02-29',
      '2026-11-03T00:00:00Z',
      20261103,
      true,
      [],
      {},
      new Date('2026-11-03T00:00:00Z'),
    ].map((value) => ({ value })),
  )('throws BadRequestException for $value', ({ value }) => {
    expect(() => toDueDateColumn(value)).toThrow(BadRequestException);
  });
});

describe('formatDueDate', () => {
  it.each(ZONES)(
    'formats a UTC-midnight date as the same calendar day in %s',
    (tz, offset) => {
      process.env.TZ = tz;
      expect(new Date('2026-11-03T12:00:00Z').getTimezoneOffset()).toBe(offset);
      expect(formatDueDate(new Date('2026-11-03T00:00:00.000Z'))).toBe(
        '2026-11-03',
      );
      expect(formatDueDate(new Date('2024-02-29T00:00:00.000Z'))).toBe(
        '2024-02-29',
      );
      expect(formatDueDate(new Date('2026-12-31T00:00:00.000Z'))).toBe(
        '2026-12-31',
      );
    },
  );

  it.each(['0001-01-01', '0099-12-31', '0050-06-15', '9999-12-31'])(
    'round-trips %s',
    (value) => {
      expect(formatDueDate(toDueDateColumn(value) as Date)).toBe(value);
    },
  );
});

describe('serializeTaskDueDates', () => {
  it('serializes the task and its returned subtasks as date-only strings', () => {
    const task = {
      id: 1,
      dueDate: new Date('2026-11-03T00:00:00.000Z'),
      completedAt: new Date('2026-11-02T20:00:00.000Z'),
      subtasks: [
        { id: 2, dueDate: new Date('2024-02-29T00:00:00.000Z') },
        { id: 3, dueDate: null },
      ],
    };
    const result = serializeTaskDueDates(task);
    expect(result.dueDate).toBe('2026-11-03');
    expect(result.subtasks.map((s) => s.dueDate)).toEqual(['2024-02-29', null]);
    // Instants are untouched.
    expect(result.completedAt).toBe(task.completedAt);
    expect(JSON.parse(JSON.stringify(result)).dueDate).toBe('2026-11-03');
  });

  it('keeps null and leaves rows without the field unchanged', () => {
    expect(serializeTaskDueDates({ id: 1, dueDate: null }).dueDate).toBeNull();
    expect(serializeTaskDueDates({ id: 1 })).toEqual({ id: 1 });
  });
});
