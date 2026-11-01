'use client';

import {
  CheckCircleIcon,
  PlusIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { Button, Sheet, SheetHeader, SheetTitle } from '@zuko/ui-kit';
import { PageHeader, SearchBar } from '@/components/shared';
import {
  useMutation,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { getTableViewTasksInfinite, getMembers } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useSheetState } from '@/hooks/use-sheet-state';
import TaskForm from './TaskForm';
import { LEGACY_ASSIGNEE_NOTE, UNASSIGNED, assigneeOptions } from './assignee';
import { tasksApi } from '@/lib/api/tasks';
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

// Cell value for an unlinked legacy name; matches no member option.
const LEGACY_CELL_VALUE = 'legacy';

const TasksList = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSheetOpen, setIsSheetOpen] = useSheetState();
  const [taskToDelete, setTaskToDelete] = useState<TaskRow | null>(null);
  const {
    inputValue: searchTerm,
    setInputValue: setSearchTerm,
    debouncedValue,
  } = useSearchParam();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(
      getTableViewTasksInfinite({ search: debouncedValue || undefined }),
    );

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

  const activeOrg = authClient.useActiveOrganization();
  const orgId = activeOrg.data?.id ?? '';
  const { data: members = [] } = useQuery({
    ...getMembers(orgId),
    enabled: !!orgId,
  });

  const { mutate: assignTask } = useMutation({
    mutationFn: ({
      id,
      assigneeUserId,
    }: {
      id: number;
      assigneeUserId: number | null;
    }) => tasksApi.updateTask(id, { assigneeUserId }),
    onSuccess: () => {
      toast.success('Assignee updated');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update assignee');
    },
  });

  const rawMetadata = data?.pages[0]?.metadata ?? [];
  const totalCount = data?.pages[0]?.pagination?.total;

  // The assignee cell is keyed by user ID, never by name. Unlinked legacy
  // names are labelled and get a value no member option can match.
  const tasks = useMemo(
    () =>
      (data?.pages.flatMap((p) => p.data) ?? []).map((row) => {
        const name = (row.assignee as string | null | undefined) ?? '';
        const assigneeUserId = row.assigneeUserId as number | null | undefined;
        const assignee =
          assigneeUserId != null
            ? { value: String(assigneeUserId), display: name }
            : name
              ? {
                  value: LEGACY_CELL_VALUE,
                  display: `${name} (${LEGACY_ASSIGNEE_NOTE})`,
                }
              : { value: UNASSIGNED, display: '' };
        return { ...row, assignee };
      }),
    [data],
  );

  const metadata = useMemo(
    () =>
      rawMetadata.map((col) => {
        if (col.id === 'assignee') {
          return {
            ...col,
            fieldType: 'relation' as const,
            config: {
              ...col.config,
              options: assigneeOptions(members).map((o) => ({
                value: o.value,
                label: o.description
                  ? `${o.label} (${o.description})`
                  : o.label,
              })),
            },
          };
        }
        return col;
      }),
    [rawMetadata, members],
  );

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
        action={
          <Button onClick={() => setIsSheetOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            New Task
          </Button>
        }
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
        totalCount={totalCount}
        entityName="tasks"
        onCellUpdate={(rowId, columnId, value) =>
          columnId === 'assignee'
            ? assignTask({
                id: Number(rowId),
                assigneeUserId: value ? Number(value) : null,
              })
            : updateCell({ rowId, columnId, value })
        }
        onFetchNextPage={fetchNextPage}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        showEmptyState
        emptyStateConfig={{
          icon: ClipboardDocumentListIcon,
          title: 'No tasks yet',
          description:
            "Create your first task to start tracking your team's work.",
          action: { label: 'New Task', onClick: () => setIsSheetOpen(true) },
        }}
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

      <Sheet open={isSheetOpen} onClose={setIsSheetOpen} side="right">
        <SheetHeader>
          <SheetTitle>New Task</SheetTitle>
          <Button plain onClick={() => setIsSheetOpen(false)}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </SheetHeader>
        <TaskForm
          mode="create"
          onSuccess={() => setIsSheetOpen(false)}
          onCancel={() => setIsSheetOpen(false)}
        />
      </Sheet>
    </>
  );
};

export default TasksList;
