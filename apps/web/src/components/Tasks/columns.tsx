'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Badge, Input } from '@zuko/ui-kit';
import dayjs from 'dayjs';
import { useRef, useState } from 'react';
import { CheckIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { Task, TaskStatus, UpdateTaskDto } from '@/lib/api/tasks';
import { EMPTY_VALUE, TableActions, EditAction, DeleteAction, TableActionButton } from '@/components/Table';

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

type TaskColumnCallbacks = {
  onUpdate: (id: number, data: UpdateTaskDto) => void;
  onEdit: (task: FlatTask) => void;
  onDelete: (task: FlatTask) => void;
  onComplete: (task: FlatTask) => void;
};

function IdCell({ id }: { id: number }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(String(id)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      onClick={handleCopy}
      className="inline-flex items-center cursor-pointer  gap-1 rounded px-1.5 py-0.5 text-xs font-mono text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
    >
      {copied ? (
        <>
          <CheckIcon className="h-3 w-3 text-green-500" />
          <span className="text-green-500">Copied</span>
        </>
      ) : (
        <span className="font-mono">{id}</span>
      )}
    </div>
  );
}

function StatusCell({ task, onUpdate }: { task: FlatTask; onUpdate: (id: number, data: UpdateTaskDto) => void }) {
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

function AssigneeCell({ task, onUpdate }: { task: FlatTask; onUpdate: (id: number, data: UpdateTaskDto) => void }) {
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
    <Input
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
      className="h-auto py-1.5 text-sm"
    />
  );
}

function TaskActionsDropdown({
  task,
  callbacks,
}: {
  task: FlatTask;
  callbacks: TaskColumnCallbacks;
}) {
  const { onEdit, onDelete, onComplete } = callbacks;
  const isComplete = task.status === 'DONE';

  return (
    <TableActions>
      <EditAction onClick={() => onEdit(task)} label="Edit task" />
      {!isComplete && (
        <TableActionButton
          onClick={() => onComplete(task)}
          label="Mark complete"
          variant="success"
        >
          <CheckCircleIcon className="h-4 w-4 text-zinc-400 group-data-[hover]:text-green-500 dark:group-data-[hover]:text-green-400" />
        </TableActionButton>
      )}
      <DeleteAction onClick={() => onDelete(task)} label="Delete task" />
    </TableActions>
  );
}

export function createTaskColumns(callbacks: TaskColumnCallbacks): ColumnDef<FlatTask>[] {
  const { onUpdate } = callbacks;
  return [
    {
      id: 'id',
      accessorKey: 'id',
      header: 'ID',
      cell: ({ row }) => <IdCell id={row.original.id} />,
    },
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => {
        const task = row.original;
        return (
          <div className="max-w-80">
            <div className="truncate font-medium text-zinc-950 dark:text-white">
              {task.title}
            </div>
          </div>
        );
      },
    },
    {
      id: 'subtasks',
      header: 'Subtasks',
      cell: ({ row }) => {
        const task = row.original;
        if (task.parentTitle) return <span className="text-sm text-zinc-400">—</span>;
        const count = task.subtasks.length;
        if (count === 0) return <span className="text-sm text-zinc-400">—</span>;
        return (
          <Badge color="zinc" className="text-xs">
            {count} subtask{count !== 1 ? 's' : ''}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusCell task={row.original} onUpdate={(id, data) => onUpdate(id, data)} />
      ),
    },
    {
      accessorKey: 'assignee',
      header: 'Assignee',
      cell: ({ row }) => (
        <AssigneeCell task={row.original} onUpdate={(id, data) => onUpdate(id, data)} />
      ),
    },
    {
      accessorKey: 'owners',
      header: 'Created By',
      cell: ({ row }) => {
        const primaryOwner = row.original.owners?.find((o) => o.isPrimary);
        return (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {primaryOwner?.user.name ?? EMPTY_VALUE}
          </span>
        );
      },
    },
    {
      accessorKey: 'completedAt',
      header: 'Completed At',
      cell: ({ getValue }) => {
        const date = getValue() as string | null;
        return (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {date ? dayjs(date).format('MMM D, YYYY') : '—'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: () => <div className="text-center">Actions</div>,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <TaskActionsDropdown task={row.original} callbacks={callbacks} />
        </div>
      ),
    },
  ];
}

// Backward-compatible export (no-op callbacks for standalone column usage)
export const taskColumns = createTaskColumns({
  onUpdate: () => undefined,
  onEdit: () => undefined,
  onDelete: () => undefined,
  onComplete: () => undefined,
});
