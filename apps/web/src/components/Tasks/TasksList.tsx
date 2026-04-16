'use client';

import {
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { PageHeader, SearchBar } from '@/components/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTableViewTasks } from '@/server/query-options';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { tasksApi } from '@/lib/api/tasks';
import { useAddRow } from '@/hooks/use-add-row';
import { useCellUpdate } from '@/hooks/use-cell-update';
import {
  BaseTable,
  createColumnsFromMetadata,
  type BaseRow,
  TableActions,
  DeleteAction,
  TableActionButton,
} from '../Table';
import type { ColumnDef } from '@tanstack/react-table';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { toast } from 'sonner';
import { useSearchParam } from '@/hooks/use-search-param';

type TaskRow = BaseRow & { status?: string };

const TasksList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [taskToDelete, setTaskToDelete] = useState<TaskRow | null>(null);
  const { inputValue: searchTerm, setInputValue: setSearchTerm, debouncedValue } = useSearchParam();

  const { data, isLoading } = useQuery(
    getTableViewTasks({ search: debouncedValue || undefined }),
  );
  const { addRow: addTask } = useAddRow('tasks');
  const { updateCell } = useCellUpdate('tasks');

  const { mutate: deleteTask, isPending: isDeleting } = useMutation({
    mutationFn: (id: number) => tasksApi.deleteTask(id),
    onSuccess: () => {
      toast.success('Task deleted');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setTaskToDelete(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete task');
    },
  });

  const { mutate: completeTask } = useMutation({
    mutationFn: (id: number) =>
      tasksApi.updateTask(id, {
        status: 'DONE',
        completedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast.success('Task marked as complete');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to complete task');
    },
  });

  const metadata = data?.metadata || [];
  const tasks = data?.data || [];

  const actionsColumn: ColumnDef<BaseRow> = useMemo(
    () => ({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const task = row.original as TaskRow;
        const isComplete = task.status === 'DONE';
        return (
          <TableActions>
            {!isComplete && (
              <TableActionButton
                onClick={() => completeTask(Number(task.id))}
                label="Mark complete"
                variant="success"
              >
                <CheckCircleIcon className="h-4 w-4 text-zinc-400 group-data-[hover]:text-green-500 dark:group-data-[hover]:text-green-400" />
              </TableActionButton>
            )}
            <DeleteAction
              onClick={() => setTaskToDelete(task)}
              label="Delete task"
            />
          </TableActions>
        );
      },
    }),
    [completeTask],
  );

  const columns = useMemo(
    () => createColumnsFromMetadata<BaseRow>(metadata).concat(actionsColumn),
    [metadata, actionsColumn],
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Manage and track your team's work"
      />

      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Search tasks..."
      />

      <BaseTable
        columns={columns}
        data={tasks}
        loading={isLoading}
        onRowClick={(task) => router.push(`/tasks/${task.id}`)}
        totalCount={tasks.length}
        entityName="tasks"
        onCellUpdate={(rowId, columnId, value) =>
          updateCell({ rowId, columnId, value })
        }
        showAddRow
        onAddRow={() => addTask()}
      />

      <ConfirmDialog
        open={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={() => taskToDelete && deleteTask(Number(taskToDelete.id))}
        title="Delete Task"
        description={
          taskToDelete
            ? `Are you sure you want to delete this task? This action cannot be undone.`
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
