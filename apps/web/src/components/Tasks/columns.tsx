'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@zuko/ui-kit';
import dayjs from 'dayjs';
import type { Task, TaskStatus } from '@/lib/api/tasks';

const statusConfig: Record<
  TaskStatus,
  { label: string; color: 'zinc' | 'blue' | 'green' | 'red' }
> = {
  TODO: { label: 'To Do', color: 'zinc' },
  IN_PROGRESS: { label: 'In Progress', color: 'blue' },
  DONE: { label: 'Done', color: 'green' },
  CANCELLED: { label: 'Cancelled', color: 'red' },
};

export const taskColumns: ColumnDef<Task>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => {
      const task = row.original;
      return (
        <div>
          <div className="font-medium text-zinc-950 dark:text-white">
            {task.title}
          </div>
          {task.description && (
            <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
              {task.description}
            </div>
          )}
          {task.subtasks.length > 0 && (
            <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
              {task.subtasks.length} subtask{task.subtasks.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => {
      const status = getValue() as TaskStatus;
      const cfg = statusConfig[status] ?? { label: status, color: 'zinc' as const };
      return (
        <Badge color={cfg.color} className="text-xs">
          {cfg.label}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'assignee',
    header: 'Assignee',
    cell: ({ getValue }) => (
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {(getValue() as string | null) || '-'}
      </span>
    ),
  },
  {
    accessorKey: 'completedAt',
    header: 'Completed',
    cell: ({ getValue }) => {
      const date = getValue() as string | null;
      return (
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          {date ? dayjs(date).format('MMM D, YYYY') : '-'}
        </span>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ getValue }) => (
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {dayjs(getValue() as string).format('MMM D, YYYY')}
      </span>
    ),
  },
];
