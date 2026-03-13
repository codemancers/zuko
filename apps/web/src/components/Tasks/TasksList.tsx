'use client';

import { ClipboardDocumentListIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Divider, Heading, Button } from '@zuko/ui-kit';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTasks } from '@/server/query-options';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { tasksApi, UpdateTaskDto } from '@/lib/api/tasks';
import { createTaskColumns, FlatTask } from './columns';
import { BaseTable } from '../Table';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';

const TasksList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [taskToDelete, setTaskToDelete] = useState<FlatTask | null>(null);
  const { data, isLoading } = useQuery(getTasks());

  const { mutate: updateTask } = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskDto }) =>
      tasksApi.updateTask(id, data),
    onSuccess: (_, { data: updateData }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (updateData.status === 'DONE') {
        toast.success('Task marked as complete');
      } else {
        toast.success('Task updated successfully');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update task');
    },
  });

  const { mutate: deleteTask, isPending: isDeleting } = useMutation({
    mutationFn: (id: number) => tasksApi.deleteTask(id),
    onSuccess: () => {
      toast.success('Task deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTaskToDelete(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete task');
    },
  });

  const columns = useMemo(
    () =>
      createTaskColumns({
        onUpdate: (id, data) => updateTask({ id, data }),
        onEdit: (task) => router.push(`/tasks/${task.id}/edit`),
        onDelete: (task) => setTaskToDelete(task),
        onComplete: (task) =>
          updateTask({
            id: task.id,
            data: {
              status: 'DONE',
              completedAt: new Date().toISOString(),
            },
          }),
      }),
    [updateTask, router],
  );

  const flatTasks = useMemo<FlatTask[]>(() => {
    const rows: FlatTask[] = [];
    for (const task of data?.tasks ?? []) {
      rows.push(task);
      for (const sub of task.subtasks) {
        rows.push({ ...sub, parentTitle: task.title });
      }
    }
    return rows;
  }, [data?.tasks]);

  return (
    <>
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <Heading>Tasks</Heading>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Manage and track your team's work
          </p>
        </div>
        <Button onClick={() => router.push('/tasks/new')}>
          <PlusIcon className="h-4 w-4" />
          New Task
        </Button>
      </div>

      <Divider className="mt-6" />

      <BaseTable
        columns={columns}
        data={flatTasks}
        loading={isLoading}
        onRowClick={(task) => router.push(`/tasks/${task.id}`)}
        totalCount={data?.pagination?.total}
        entityName="tasks"
        emptyStateConfig={{
          icon: ClipboardDocumentListIcon,
          title: 'No Tasks',
          description: 'Get started by creating a new task.',
          action: {
            label: 'New Task',
            onClick: () => router.push('/tasks/new'),
          },
        }}
      />

      <ConfirmDialog
        open={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={() => taskToDelete && deleteTask(taskToDelete.id)}
        title="Delete Task"
        description={
          taskToDelete
            ? `Are you sure you want to delete "${taskToDelete.title}"? This action cannot be undone.`
            : ''
        }
        confirmText="Delete"
        confirmColor="red"
        isLoading={isDeleting}
      />
    </>
  );
};

export default TasksList;
