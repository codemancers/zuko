'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTask } from '@/server/query-options';
import { tasksApi } from '@/lib/api/tasks';
import { useRouter } from 'next/navigation';
import { Badge, Button, Divider, Heading, Subheading } from '@zuko/ui-kit';
import dayjs from 'dayjs';
import { ChevronLeftIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { TaskStatus } from '@/lib/api/tasks';
import { useState } from 'react';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';
import { toast } from 'sonner';

const statusConfig: Record<
  TaskStatus,
  { label: string; color: 'zinc' | 'blue' | 'green' | 'red' }
> = {
  TODO: { label: 'To Do', color: 'zinc' },
  IN_PROGRESS: { label: 'In Progress', color: 'blue' },
  DONE: { label: 'Done', color: 'green' },
  CANCELLED: { label: 'Cancelled', color: 'red' },
};

interface TaskDetailProps {
  taskId: number;
  currentUserId?: number | null;
}

const TaskDetail = ({ taskId, currentUserId }: TaskDetailProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: task, isLoading } = useQuery(getTask(taskId));
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => tasksApi.deleteTask(taskId),
    onSuccess: () => {
      toast.success('Task deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      router.push('/tasks');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete task');
    },
  });

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500">Loading...</div>
    );
  }

  if (!task) {
    return (
      <div className="py-12 text-center text-sm text-zinc-500">
        Task not found.
      </div>
    );
  }

  const statusCfg = statusConfig[task.status] ?? {
    label: task.status,
    color: 'zinc' as const,
  };

  const handleDelete = () => {
    deleteMutation.mutate();
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Link href="/tasks" className="inline-flex items-center gap-2 text-sm/6 text-zinc-500 dark:text-zinc-400">
        <ChevronLeftIcon className="size-4" />
        Tasks
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <Heading>{task.title}</Heading>
          {task.description && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {task.description}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button outline onClick={() => router.push(`/tasks/${taskId}/edit`)}>
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
          <Button
            color="red"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleteMutation.isPending}
          >
            <TrashIcon className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Divider className="mt-6" />

      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Task"
        description={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="red"
        isLoading={deleteMutation.isPending}
      />

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          {
            label: 'Status',
            value: <Badge color={statusCfg.color}>{statusCfg.label}</Badge>,
          },
          {
            label: 'Assignee',
            value: task.assignee || (
              <span className="text-zinc-400">Unassigned</span>
            ),
          },
          {
            label: 'Completed',
            value: task.completedAt
              ? dayjs(task.completedAt).format('MMM D, YYYY')
              : <span className="text-zinc-400">—</span>,
          },
          {
            label: 'Created',
            value: dayjs(task.createdAt).format('MMM D, YYYY'),
          },
          {
            label: 'Updated',
            value: dayjs(task.updatedAt).format('MMM D, YYYY'),
          },
        ].map(({ label, value }) => (
          <div key={label}>
            <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              {label}
            </dt>
            <dd className="mt-1 text-sm text-zinc-900 dark:text-white">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {task.subtasks.length > 0 && (
        <>
          <Divider className="mt-8" />
          <div className="mt-6">
            <Subheading>Subtasks ({task.subtasks.length})</Subheading>
            <div className="mt-4 space-y-2">
              {task.subtasks.map((sub) => {
                const subStatus = statusConfig[sub.status] ?? {
                  label: sub.status,
                  color: 'zinc' as const,
                };
                return (
                  <div
                    key={sub.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
                    onClick={() => router.push(`/tasks/${sub.id}`)}
                  >
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {sub.title}
                    </span>
                    <Badge color={subStatus.color} className="text-xs">
                      {subStatus.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
            <div className="mt-4">
              <Button
                outline
                onClick={() =>
                  router.push(`/tasks/new?parentId=${task.id}`)
                }
              >
                Add subtask
              </Button>
            </div>
          </div>
        </>
      )}

      {task.subtasks.length === 0 && (
        <div className="mt-6">
          <Button
            outline
            onClick={() => router.push(`/tasks/new?parentId=${task.id}`)}
          >
            Add subtask
          </Button>
        </div>
      )}

      {/* Activity Timeline */}
      <div className="mt-8">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Activity
        </h2>
        <div className="mt-4">
          <ActivityTimeline
            entityType="task"
            entityId={taskId}
            currentUserId={currentUserId ?? undefined}
          />
        </div>
      </div>
    </>
  );
};

export default TaskDetail;
