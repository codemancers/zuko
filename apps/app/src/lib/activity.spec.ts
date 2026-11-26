import { describe, expect, it } from 'vitest';
import {
  groupTimeline,
  mentionQuery,
  mentionedIds,
  type ActivityItem,
  type ChangeItem,
  type CommentItem,
} from './activity';

const change = (id: string, at: string, actor = '7', type = 'USER'): ChangeItem => ({
  type: 'change',
  id,
  action: 'UPDATE',
  changes: {},
  actor_type: type,
  actor_id: actor,
  actor_name: null,
  created_at: `2026-11-20T${at}.000Z`,
});
const comment = (id: string, at: string): CommentItem => ({
  type: 'comment',
  id,
  record_id: '1',
  body: 'hi',
  mentions: [],
  actor_type: 'USER',
  actor_id: '7',
  actor_name: 'Me',
  edited_at: null,
  created_at: `2026-11-20T${at}.000Z`,
});

describe('groupTimeline', () => {
  it('folds changes by one actor made close together into one block', () => {
    const blocks = groupTimeline([
      change('1', '09:00:00'),
      change('2', '09:04:00'),
      change('3', '09:08:00'), // each within ten minutes of the one before
    ]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      kind: 'changes',
      entries: [{ id: '1' }, { id: '2' }, { id: '3' }],
    });
  });

  it('starts a new block for another actor, another way in, or a long pause', () => {
    const blocks = groupTimeline([
      change('1', '09:00:00'),
      change('2', '09:01:00', '8'),
      change('3', '09:02:00', '8', 'MCP'),
      change('4', '10:00:00', '8', 'MCP'),
    ]);
    expect(blocks.map((b) => (b.kind === 'changes' ? b.entries.map((e) => e.id) : []))).toEqual([
      ['1'],
      ['2'],
      ['3'],
      ['4'],
    ]);
  });

  it('keeps each comment on its own and breaks a run of changes around it', () => {
    const items: ActivityItem[] = [
      change('1', '09:00:00'),
      comment('1', '09:01:00'),
      change('2', '09:02:00'),
    ];
    expect(groupTimeline(items).map((b) => b.key)).toEqual(['change-1', 'comment-1', 'change-2']);
  });

  it('tells a change and a comment with the same number apart', () => {
    const keys = groupTimeline([change('5', '09:00:00'), comment('5', '09:30:00')]).map(
      (b) => b.key,
    );
    expect(new Set(keys).size).toBe(2);
  });
});

describe('mentionedIds', () => {
  const members = [
    { value: '1', label: 'Sam' },
    { value: '2', label: 'Sam Lee' },
    { value: '3', label: 'Pat (Sales)' },
  ];
  it('finds who is named, and prefers the longer name', () => {
    expect(mentionedIds('ping @Sam Lee and @Pat (Sales)', members).sort()).toEqual(['2', '3']);
    expect(mentionedIds('ping @Sam, thanks', members)).toEqual(['1']);
  });
  it('ignores a name that only starts with a member’s, and text with no @', () => {
    expect(mentionedIds('@Samuel was here', members)).toEqual([]);
    expect(mentionedIds('Sam was here', members)).toEqual([]);
  });
  it('names a person once however often they are mentioned', () => {
    expect(mentionedIds('@Sam @Sam', members)).toEqual(['1']);
  });
});

describe('mentionQuery', () => {
  it('reads the @word just before the caret', () => {
    expect(mentionQuery('hello @Sa', 9)).toEqual({ start: 6, query: 'Sa' });
    expect(mentionQuery('@', 1)).toEqual({ start: 0, query: '' });
  });
  it('is nothing once the word is finished or is part of an address', () => {
    expect(mentionQuery('hello @Sam ', 11)).toBeNull();
    expect(mentionQuery('mail me@x.com', 13)).toBeNull();
    expect(mentionQuery('no mention', 10)).toBeNull();
  });
});
