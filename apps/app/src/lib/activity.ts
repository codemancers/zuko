import type { HistoryEntry } from '@/lib/records';

/** A comment on a record, as the API returns it. */
export interface CommentItem {
  type: 'comment';
  id: string;
  record_id: string;
  body: string;
  mentions: string[];
  actor_type: string;
  actor_id: string | null;
  actor_name: string | null;
  edited_at: string | null;
  created_at: string;
}

export type ChangeItem = HistoryEntry & { type: 'change'; actor_name: string | null };

/** One entry of a record's timeline. Changes and comments are numbered separately: identify one by type and id. */
export type ActivityItem = ChangeItem | CommentItem;

export interface ActivityPage {
  /** Oldest first. */
  results: ActivityItem[];
  /** Set when there are earlier items than these. */
  next_before: string | null;
}

export type Block =
  | { kind: 'comment'; key: string; comment: CommentItem }
  | { kind: 'changes'; key: string; entries: ChangeItem[] };

/** Changes by one actor this close together read as one edit session, like several commits pushed at once. */
export const GROUP_WINDOW_MS = 10 * 60 * 1000;

/** The timeline as blocks: each comment on its own, and runs of changes by the same actor folded together. */
export function groupTimeline(items: ActivityItem[], windowMs = GROUP_WINDOW_MS): Block[] {
  const blocks: Block[] = [];
  for (const item of items) {
    if (item.type === 'comment') {
      blocks.push({ kind: 'comment', key: `comment-${item.id}`, comment: item });
      continue;
    }
    const last = blocks.at(-1);
    const previous = last?.kind === 'changes' ? last.entries.at(-1) : undefined;
    if (
      last?.kind === 'changes' &&
      previous &&
      previous.actor_id === item.actor_id &&
      previous.actor_type === item.actor_type &&
      new Date(item.created_at).getTime() - new Date(previous.created_at).getTime() <= windowMs
    ) {
      last.entries.push(item);
    } else {
      blocks.push({ kind: 'changes', key: `change-${item.id}`, entries: [item] });
    }
  }
  return blocks;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The members a comment mentions: those whose `@Name` it contains. The longest name wins where one
 * is the start of another ("@Sam Lee" is Sam Lee, not Sam).
 */
export function mentionedIds(body: string, members: { value: string; label: string }[]): string[] {
  const found = new Set<string>();
  let rest = body;
  for (const member of [...members].sort((a, b) => b.label.length - a.label.length)) {
    if (!member.label) continue;
    const pattern = new RegExp(`@${escape(member.label)}(?![\\p{L}\\p{N}_])`, 'gu');
    if (pattern.test(rest)) {
      found.add(member.value);
      rest = rest.replace(pattern, ' ');
    }
  }
  return [...found];
}

/** The `@word` being typed just before the caret, if any. */
export function mentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const match = /(^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
  return match ? { start: caret - match[2].length - 1, query: match[2] } : null;
}
