'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@zuko/ui-kit';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';
import type { Task, TaskStatus, UpdateTaskDto } from '@/lib/api/tasks';

export type FlatTask = Task & { parentTitle?: string };

const statusConfig: Record<
  TaskStatus,
  { label: string; color: 'zinc' | 'blue' | 'green' | 'red' }
> = {
  TODO: { label: 'To Do', color: 'zinc' },
  IN_PROGRESS: { label: 'In Progress', color: 'blue' },
  DONE: { label: 'Done', color: 'green' },
  CANCELLED: { label: 'Cancelled', color: 'red' },
};

const ALL_STATUSES = Object.keys(statusConfig) as TaskStatus[];

type OnUpdate = (id: number, data: UpdateTaskDto) => void;

function StatusCell({ task, onUpdate }: { task: FlatTask; onUpdate: OnUpdate }) {
  const cfg = statusConfig[task.status] ?? { label: task.status, color: 'zinc' as const };

  return (
    <div className="relative inline-flex cursor-pointer" onClick={(e) => e.stopPropagation()}>
      <Badge color={cfg.color} className="pointer-events-none text-xs">
        {cfg.label}
      </Badge>
      <select
        value={task.status}
        onChange={(e) => {
          const next = e.target.value as TaskStatus;
          const update: UpdateTaskDto = { status: next };
          if (next === 'DONE') {
            update.completedAt = new Date().toISOString();
          } else if (task.status === 'DONE') {
            update.completedAt = null;
          }
          onUpdate(task.id, update);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {statusConfig[s].label}
          </option>
        ))}
      </select>
    </div>
  );
}

function AssigneeCell({ task, onUpdate }: { task: FlatTask; onUpdate: OnUpdate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.assignee ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = value.trim();
    const next = trimmed === '' ? null : trimmed;
    if (next !== (task.assignee ?? null)) {
      onUpdate(task.id, { assignee: next });
    }
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setValue(task.assignee ?? '');
          setEditing(true);
        }}
        className="cursor-text rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-left text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800/60"
      >
        {task.assignee || 'Unassigned'}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      autoFocus
      type="text"
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          inputRef.current?.blur();
        }
        if (e.key === 'Escape') {
          setValue(task.assignee ?? '');
          setEditing(false);
        }
      }}
      placeholder="Unassigned"
      className="rounded-lg border border-zinc-600 bg-zinc-800/60 px-3 py-1.5 text-sm text-zinc-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );
}

export function createTaskColumns(onUpdate: OnUpdate): ColumnDef<FlatTask>[] {
  return [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => {
        const task = row.original;
        return (
          <div className="max-w-96">
            {task.parentTitle && (
              <div className="mb-0.5 truncate text-xs text-zinc-500 dark:text-zinc-500">
                Subtask of{' '}
                <span className="font-medium text-zinc-400 dark:text-zinc-400">
                  {task.parentTitle}
                </span>
              </div>
            )}
            <div className="truncate font-medium text-zinc-950 dark:text-white">
              {task.title}
            </div>
            {task.description && (
              <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {task.description}
              </div>
            )}
            {!task.parentTitle && task.subtasks.length > 0 && (
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
      cell: ({ row }) => <StatusCell task={row.original} onUpdate={onUpdate} />,
    },
    {
      accessorKey: 'assignee',
      header: 'Assignee',
      cell: ({ row }) => <AssigneeCell task={row.original} onUpdate={onUpdate} />,
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
}

// Backward-compatible export
export const taskColumns = createTaskColumns(() => undefined);
