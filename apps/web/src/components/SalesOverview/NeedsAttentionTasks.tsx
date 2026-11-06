'use client';

import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { EmptyState } from '@/components/shared';
import {
  Badge,
  Button,
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from '@zuko/ui-kit';
import { getNeedsAttention } from '@/lib/api/sales-overview';
import type { AttentionTask } from '@/lib/api/sales-overview';

export function TaskPersonLink({ task }: { task: AttentionTask }) {
  const person = task.contactId
    ? { type: 'Contact', route: 'contacts', id: task.contactId }
    : task.prospectId
      ? { type: 'Prospect', route: 'prospects', id: task.prospectId }
      : null;
  return person ? (
    <Link
      className="underline underline-offset-2 hover:text-zinc-950 dark:hover:text-white"
      href={`/${person.route}/${person.id}`}
    >
      {person.type} #{person.id}
    </Link>
  ) : null;
}

export function NeedsAttentionTasks({
  organizationId,
}: {
  organizationId: number;
}) {
  const [date, setDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  useEffect(() => {
    const refreshDay = () => setDate(dayjs().format('YYYY-MM-DD'));
    const timer = window.setInterval(refreshDay, 60000);
    window.addEventListener('focus', refreshDay);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshDay);
    };
  }, []);
  return (
    <AttentionList
      key={`${organizationId}:${date}`}
      organizationId={organizationId}
      date={date}
    />
  );
}

function AttentionList({
  organizationId,
  date,
}: {
  organizationId: number;
  date: string;
}) {
  const [page, setPage] = useState(1);
  const [reviewId, setReviewId] = useState<number | null>(null);
  const { data, isPending, isError, refetch, isFetching } = useQuery({
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    queryKey: ['tasks', 'needs-attention', organizationId, date, page],
    queryFn: ({ signal }) =>
      getNeedsAttention(organizationId, date, page, signal),
  });
  if (isPending)
    return (
      <output className="mt-4 block text-sm text-zinc-500 dark:text-zinc-400">
        Loading tasks…
      </output>
    );
  if (isError)
    return (
      <div className="mt-4 space-y-3">
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          Unable to load tasks. Try again.
        </p>
        <Button outline onClick={() => void refetch()} disabled={isFetching}>
          Retry tasks
        </Button>
      </div>
    );
  if (!data.pagination.total && page === 1)
    return (
      <EmptyState
        title="No tasks need attention"
        description="No unfinished sales tasks are due today or overdue for organization Owners/Admins."
      />
    );
  const reviewTask = data.tasks.find((task) => task.id === reviewId);
  return (
    <>
      {!data.tasks.length && (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          No tasks on this page. Return to the previous page.
        </p>
      )}
      <ul className="mt-3 divide-y divide-zinc-950/10 dark:divide-white/10">
        {data?.tasks.map((task) => (
          <li key={task.id} className="min-w-0 py-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Task</p>
            <p className="mt-1 break-words text-sm font-semibold text-zinc-950 dark:text-white">
              {task.title}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
              <time dateTime={task.dueDate}>
                {task.dueDate === date ? 'Due today' : 'Overdue'} ·{' '}
                {dayjs(task.dueDate).format('D MMM YYYY')}
              </time>
              <span>{task.assigneeUser.name}</span>
              <TaskPersonLink task={task} />
              {(task.priority === 'HIGH' || task.priority === 'URGENT') && (
                <Badge color="amber">
                  {task.priority === 'HIGH' ? 'High' : 'Urgent'}
                </Badge>
              )}
            </div>
            <Button
              plain
              className="mt-2"
              aria-label={`Review ${task.title}`}
              onClick={() => setReviewId(task.id)}
            >
              Review
            </Button>
          </li>
        ))}
      </ul>
      {(data.pagination.totalPages > 1 || page > 1) && (
        <nav
          aria-label="Needs attention pages"
          className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-950/10 pt-3 text-sm dark:border-white/10"
        >
          <Button
            plain
            aria-label="Previous tasks"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-zinc-500 dark:text-zinc-400">
            Page {page} · {data.pagination.total} tasks
          </span>
          <Button
            plain
            aria-label="Next tasks"
            disabled={page >= data.pagination.totalPages || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </nav>
      )}
      <Sheet open={!!reviewTask} onClose={() => setReviewId(null)} side="right">
        <SheetHeader>
          <SheetTitle>Review task</SheetTitle>
          <Button
            plain
            aria-label="Close task review"
            onClick={() => setReviewId(null)}
          >
            Close
          </Button>
        </SheetHeader>
        {reviewTask && (
          <SheetBody>
            <p className="break-words font-semibold text-zinc-950 dark:text-white">
              {reviewTask.title}
            </p>
            <dl className="mt-4 space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
              <div>
                <dt className="font-medium">Assignee</dt>
                <dd>{reviewTask.assigneeUser.name}</dd>
              </div>
              <div>
                <dt className="font-medium">Due date</dt>
                <dd>
                  <time dateTime={reviewTask.dueDate}>
                    {dayjs(reviewTask.dueDate).format('D MMM YYYY')}
                  </time>
                </dd>
              </div>
              <div>
                <dt className="font-medium">Status</dt>
                <dd>
                  {reviewTask.status === 'IN_PROGRESS'
                    ? 'In progress'
                    : 'To do'}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Priority</dt>
                <dd>{reviewTask.priority}</dd>
              </div>
            </dl>
            <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
              <TaskPersonLink task={reviewTask} />
            </div>
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              Reviewing does not change this task. Dashboard completion and
              rescheduling actions are not available yet.
            </p>
            <div className="mt-6">
              <Button outline href={`/tasks/${reviewTask.id}`}>
                Open full task
              </Button>
            </div>
          </SheetBody>
        )}
      </Sheet>
    </>
  );
}
