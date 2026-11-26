'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, LoaderCircle } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import {
  groupTimeline,
  mentionQuery,
  mentionedIds,
  type ActivityPage,
  type Block,
  type CommentItem,
} from '@/lib/activity';
import { Markdown } from '@/lib/markdown-lite';
import { describeHistory, type ObjectDef } from '@/lib/records';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const when = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** The newest this many items are shown; the API pages further back, the drawer says when it does not. */
const SHOWN = 100;
const MAX_COMMENT = 10_000;

type Member = { value: string; label: string };
type Me = { user_id?: string; can_moderate_comments?: boolean };

const via = (actorType: string) =>
  actorType === 'MCP' ? 'via MCP' : actorType === 'AGENT' ? 'via agent' : '';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';

/** A record's timeline: its changes and its comments in the order they happened, with a box to comment. */
export function RecordTimeline({
  def,
  recordId,
  version,
  members,
}: {
  def: Pick<ObjectDef, 'name' | 'fields' | 'associations'>;
  recordId: string;
  /** Changes when the record does, so the timeline refreshes after an edit. */
  version: string;
  members: Member[];
}) {
  const client = useQueryClient();
  const people = Object.fromEntries(members.map((m) => [m.value, m.label]));
  const key = ['record-activity', def.name, recordId];
  const base = `/api/v1/objects/${def.name}/records/${recordId}`;
  const timeline = useQuery({
    queryKey: [...key, version],
    queryFn: ({ signal }) => api<ActivityPage>(`${base}/activity?limit=${SHOWN}`, { signal }),
  });
  const me = useQuery({
    queryKey: ['permissions'],
    queryFn: ({ signal }) => api<Me>('/api/v1/me', { signal }),
  });
  const refresh = () => client.invalidateQueries({ queryKey: key });

  const blocks = groupTimeline(timeline.data?.results ?? []);
  return (
    <section aria-label="Activity" className="mt-6 border-t pt-4">
      <h3 className="mb-3 text-sm font-medium">Activity</h3>
      {timeline.isPending && <p className="text-xs text-muted-foreground">Loading…</p>}
      {timeline.error && (
        <div role="alert" className="space-y-1">
          <p className="text-xs text-destructive">Could not load the history.</p>
          <p className="text-xs text-muted-foreground">{timeline.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => void timeline.refetch()}>
            Retry history
          </Button>
        </div>
      )}
      {timeline.data && blocks.length === 0 && (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      )}
      {timeline.data?.next_before && (
        <p className="mb-3 text-xs text-muted-foreground">
          Showing the latest {SHOWN} items; earlier activity is not shown.
        </p>
      )}
      {timeline.data && (
        <ol className="relative ml-1 flex flex-col gap-4 border-l border-border/70">
          {blocks.map((block) => (
            <TimelineBlock
              key={block.key}
              block={block}
              def={def}
              people={people}
              members={members}
              base={base}
              me={me.data}
              onChanged={refresh}
            />
          ))}
        </ol>
      )}
      {timeline.data && <Composer base={base} members={members} onPosted={refresh} />}
    </section>
  );
}

function TimelineBlock({
  block,
  def,
  people,
  members,
  base,
  me,
  onChanged,
}: {
  block: Block;
  def: Pick<ObjectDef, 'name' | 'fields' | 'associations'>;
  people: Record<string, string>;
  members: Member[];
  base: string;
  me: Me | undefined;
  onChanged: () => void;
}) {
  if (block.kind === 'comment') {
    return (
      <CommentCard
        comment={block.comment}
        who={
          block.comment.actor_name ??
          (block.comment.actor_id && people[block.comment.actor_id]) ??
          'Someone'
        }
        members={members}
        base={base}
        me={me}
        onChanged={onChanged}
      />
    );
  }
  const first = block.entries[0]!;
  const who = (first.actor_id && people[first.actor_id]) || first.actor_name || 'Someone';
  const lines = block.entries.flatMap((entry) => describeHistory(def, entry, people));
  return (
    <li className="relative pl-4 text-sm before:absolute before:top-1 before:-left-[3px] before:size-[5px] before:rounded-full before:bg-muted-foreground/50">
      <p className="text-xs text-muted-foreground">
        {who}
        {via(first.actor_type) && ` ${via(first.actor_type)}`}
        {block.entries.length > 1 && ` made ${block.entries.length} changes`} ·{' '}
        <time dateTime={first.created_at}>{when.format(new Date(first.created_at))}</time>
      </p>
      {lines.map((line, i) => (
        <p key={`${i}-${line}`}>{line}</p>
      ))}
    </li>
  );
}

function CommentCard({
  comment,
  who,
  members,
  base,
  me,
  onChanged,
}: {
  comment: CommentItem;
  who: string;
  members: Member[];
  base: string;
  me: Me | undefined;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const mine = me?.user_id !== undefined && me.user_id === comment.actor_id;
  const canDelete = mine || me?.can_moderate_comments === true;
  const url = `${base}/comments/${comment.id}`;

  const save = useMutation({
    mutationFn: () =>
      api(url, {
        method: 'PATCH',
        json: { body: draft.trim(), mentions: mentionedIds(draft, members) },
      }),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });
  const remove = useMutation({
    mutationFn: () => api(url, { method: 'DELETE' }),
    onSuccess: onChanged,
  });
  const problem = save.error ?? remove.error;

  return (
    <li className="relative pl-4">
      <article
        aria-label={`Comment by ${who}`}
        className="rounded-lg border bg-card text-sm text-card-foreground"
      >
        <header className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Avatar size="sm">
            <AvatarFallback aria-hidden>{initials(who)}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{who}</span>
          {via(comment.actor_type) && (
            <Badge variant="outline" className="gap-1">
              <Bot aria-hidden className="size-3" />
              {via(comment.actor_type)}
            </Badge>
          )}
          <span>
            commented{' '}
            <time dateTime={comment.created_at}>{when.format(new Date(comment.created_at))}</time>
            {comment.edited_at && ' · edited'}
          </span>
          {!editing && (mine || canDelete) && (
            <span className="ml-auto flex gap-1">
              {mine && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setDraft(comment.body);
                    setEditing(true);
                  }}
                >
                  Edit
                </Button>
              )}
              {canDelete &&
                (confirming ? (
                  <>
                    <Button
                      variant="destructive"
                      size="xs"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate()}
                    >
                      Yes, delete
                    </Button>
                    <Button variant="ghost" size="xs" onClick={() => setConfirming(false)}>
                      Keep
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="xs" onClick={() => setConfirming(true)}>
                    Delete
                  </Button>
                ))}
            </span>
          )}
        </header>
        <div className="px-3 py-2">
          {editing ? (
            <div className="space-y-2">
              <textarea
                aria-label="Edit comment"
                value={draft}
                maxLength={MAX_COMMENT}
                rows={3}
                onChange={(e) => setDraft(e.target.value)}
                className={textareaClass}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={save.isPending || draft.trim() === ''}
                  onClick={() => save.mutate()}
                >
                  {save.isPending && (
                    <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
                  )}
                  Save comment
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    save.reset();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Markdown text={comment.body} mentions={members.map((m) => m.label)} />
          )}
          {problem && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {problem.message}
            </p>
          )}
        </div>
      </article>
    </li>
  );
}

const textareaClass =
  'block w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive';

/** The comment box: markdown, Ctrl or Cmd + Enter to post, and @ to mention a teammate. */
function Composer({
  base,
  members,
  onPosted,
}: {
  base: string;
  members: Member[];
  onPosted: () => void;
}) {
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const post = useMutation({
    mutationFn: () =>
      api(`${base}/comments`, {
        method: 'POST',
        json: { body: text.trim(), mentions: mentionedIds(text, members) },
      }),
    onSuccess: () => {
      setText('');
      onPosted();
    },
  });

  const token = dismissed ? null : mentionQuery(text, caret);
  const options = token
    ? members.filter((m) => m.label.toLowerCase().includes(token.query.toLowerCase())).slice(0, 6)
    : [];
  const open = options.length > 0;
  const choose = (member: Member) => {
    if (!token) return;
    const at = token.start + member.label.length + 2;
    setText(`${text.slice(0, token.start)}@${member.label} ${text.slice(caret)}`);
    setCaret(at);
    requestAnimationFrame(() => {
      field.current?.focus();
      field.current?.setSelectionRange(at, at);
    });
  };
  const submit = () => {
    if (text.trim() !== '' && !post.isPending) post.mutate();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Posting wins over everything else: Ctrl or Cmd + Enter always sends what is written.
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    } else if (open && event.key === 'ArrowDown') {
      event.preventDefault();
      list.current?.querySelector('button')?.focus();
    } else if (open && event.key === 'Escape') {
      event.preventDefault();
      setDismissed(true);
    }
  };
  // Arrow keys move through the suggestions, which are plain buttons; Escape goes back to writing.
  const onListKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const buttons = [...(list.current?.querySelectorAll('button') ?? [])];
    const at = buttons.indexOf(event.currentTarget);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      buttons[(at + step + buttons.length) % buttons.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDismissed(true);
      field.current?.focus();
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="relative">
        <textarea
          ref={field}
          aria-label="Add a comment"
          aria-invalid={post.isError || undefined}
          value={text}
          maxLength={MAX_COMMENT}
          rows={3}
          placeholder="Leave a comment. Type @ to mention a teammate."
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart);
            setDismissed(false);
            if (post.isError) post.reset();
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          className={textareaClass}
        />
        {open && (
          <ul
            ref={list}
            aria-label="Teammates"
            className="absolute right-0 bottom-full left-0 z-10 mb-1 max-h-48 overflow-auto rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-md"
          >
            {options.map((member) => (
              <li key={member.value}>
                <button
                  type="button"
                  onClick={() => choose(member)}
                  onKeyDown={onListKeyDown}
                  className="w-full rounded-md px-2 py-1 text-left outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
                >
                  {member.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {post.error && (
        <p role="alert" className="text-xs text-destructive">
          {post.error instanceof ApiError ? post.error.message : 'The comment could not be posted.'}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Markdown. Ctrl or ⌘ + Enter to post.</span>
        <Button size="sm" disabled={text.trim() === '' || post.isPending} onClick={submit}>
          {post.isPending && (
            <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          Comment
        </Button>
      </div>
    </div>
  );
}
