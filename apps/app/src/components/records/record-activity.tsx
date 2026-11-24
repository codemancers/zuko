'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { describeHistory, type HistoryEntry, type ObjectDef } from '@/lib/records';

const when = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Who changed what on a record and when, newest first. */
export function RecordActivity({
  def,
  recordId,
  version,
  people,
}: {
  def: Pick<ObjectDef, 'name' | 'fields' | 'associations'>;
  recordId: string;
  /** Changes when the record does, so the list refreshes after an edit. */
  version: string;
  /** Member names by user id. */
  people: Record<string, string>;
}) {
  const history = useQuery({
    queryKey: ['record-history', def.name, recordId, version],
    queryFn: ({ signal }) =>
      api<{ results: HistoryEntry[] }>(`/api/v1/objects/${def.name}/records/${recordId}/history`, {
        signal,
      }),
  });
  const current = history.isPending
    ? null
    : {
        entries: history.data?.results,
        problem: history.error ? history.error.message : undefined,
      };
  return (
    <section aria-label="Activity" className="mt-6 border-t pt-4">
      <h3 className="mb-2 text-sm font-medium">Activity</h3>
      {!current && <p className="text-xs text-muted-foreground">Loading…</p>}
      {current?.problem && (
        <div role="alert" className="space-y-1">
          <p className="text-xs text-destructive">Could not load the history.</p>
          <p className="text-xs text-muted-foreground">{current.problem}</p>
          <Button variant="outline" size="sm" onClick={() => void history.refetch()}>
            Retry history
          </Button>
        </div>
      )}
      {current?.entries?.length === 0 && (
        <p className="text-xs text-muted-foreground">No activity yet.</p>
      )}
      {current?.entries && (
        <ol className="ml-1 flex flex-col gap-4 border-l border-border/70">
          {current.entries.map((entry) => {
            const who = (entry.actor_id && people[entry.actor_id]) || 'Someone';
            return (
              <li
                key={entry.id}
                className="relative pl-4 text-sm before:absolute before:top-1 before:-left-[3px] before:size-[5px] before:rounded-full before:bg-muted-foreground/50"
              >
                <p className="text-xs text-muted-foreground">
                  {who}
                  {entry.actor_type === 'MCP' ? ' via MCP' : ''} ·{' '}
                  {when.format(new Date(entry.created_at))}
                </p>
                {describeHistory(def, entry, people).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
