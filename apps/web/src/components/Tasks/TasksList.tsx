'use client';

import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { Divider, Heading, Input } from '@zuko/ui-kit';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTasks } from '@/server/query-options';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { tasksApi, UpdateTaskDto } from '@/lib/api/tasks';
import { useAddRow } from '@/hooks/use-add-row';
import { createTaskColumns, FlatTask } from './columns';
import { BaseTable } from '../Table';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';

const TasksList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [taskToDelete, setTaskToDelete] = useState<FlatTask | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all top-level tasks in one go; client-side pagination handles 10-per-page
  const { data, isLoading } = useQuery(getTasks({ limit: 100, search: searchTerm || undefined }));

  const { mutate: updateTask } = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTaskDto }) =>
      tasksApi.updateTask(id, data),
    onSuccess: (_, { id, data: updateData }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['timeline', 'task', id] });
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

  const { addRow: addTask } = useAddRow('tasks');

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

  // Flatten: parent task followed immediately by its subtasks
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
      <div className="flex flex-col">
        <Heading>Tasks</Heading>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Manage and track your team's work
        </p>
      </div>

      <Divider className="mt-6" />

      <div className="mt-6">
        <Input
          type="search"
          placeholder="Search tasks by title, description, or assignee..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      <BaseTable
        columns={columns}
        data={flatTasks}
        loading={isLoading}
        onRowClick={(task) => router.push(`/tasks/${task.id}`)}
        totalCount={flatTasks.length}
        entityName="tasks"
        emptyStateConfig={{
          icon: ClipboardDocumentListIcon,
          title: 'No Tasks',
          description: 'Get started by creating a new task.',
          action: {
            label: 'New Task',
            onClick: () => addTask(),
          },
        }}
        showAddRow
        onAddRow={() => addTask()}
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
