'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTask, getTasks, getMembers } from '@/server/query-options';
import { authClient } from '@/lib/auth-client';
import { tasksApi } from '@/lib/api/tasks';
import { metadataApi } from '@/lib/api/metadata';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Divider,
  Sheet,
  SheetBody,
  SheetHeader,
  SheetTitle,
  Subheading,
} from '@zuko/ui-kit';
import {
  TrashIcon,
  PencilIcon,
  ClipboardDocumentCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import TaskForm from './TaskForm';
import type { TaskStatus, UpdateTaskDto } from '@/lib/api/tasks';
import { useState } from 'react';
import { useAutosaveField } from '@/hooks/useAutosaveField';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import {
  BackLink,
  DetailHeader,
  EntityProperties,
  LoadingState,
} from '@/components/shared';
import ActivityTimeline from '@/components/Activity/ActivityTimeline';
import { toast } from 'sonner';
import Editor, { ensureOutputData } from '@/components/Common/Editor/Editor';
import type { OutputData } from '@editorjs/editorjs';

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
  const { data: taskStatuses = [] } = useQuery({
    queryKey: ['taskStatuses'],
    queryFn: metadataApi.getTaskStatuses,
  });
  const { data: tasksData } = useQuery(getTasks());
  const allTasks = tasksData?.tasks ?? [];

  const activeOrg = authClient.useActiveOrganization();
  const orgId = activeOrg.data?.id ?? '';
  const { data: members = [] } = useQuery({
    ...getMembers(orgId),
    enabled: !!orgId,
  });

  const memberOptions = [
    { value: '', label: 'Unassigned' },
    ...members.map((m) => ({ value: m.user.name, label: m.user.name })),
  ];
  const parentTaskOptions = allTasks
    .filter((t) => t.id !== taskId)
    .map((t) => ({ value: String(t.id), label: t.title }));
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (updated: UpdateTaskDto) =>
      tasksApi.updateTask(taskId, updated),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['timeline', 'task', taskId] });
    },
    onError: () => {
      toast.error('Failed to save changes');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  const titleField = useAutosaveField(task?.title, {
    fieldName: 'task title',
    onSave: (val) => updateMutation.mutateAsync({ title: val }),
  });

  const descriptionField = useAutosaveField<OutputData>(
    ensureOutputData(task?.description),
    {
      fieldName: 'description',
      onSave: (val) => updateMutation.mutateAsync({ description: val }),
    },
  );

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
    return <LoadingState message="Loading..." />;
  }

  if (!task) {
    return <LoadingState message="Task not found." />;
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
      <BackLink href="/tasks">Tasks</BackLink>

      <div className="mt-4 flex items-start justify-between">
        <DetailHeader
          icon={ClipboardDocumentCheckIcon}
          title={titleField.value}
          onTitleBlur={(val) => titleField.setValue(val)}
          isSaving={
            titleField.isSaving ||
            descriptionField.isSaving ||
            updateMutation.isPending
          }
          createdAt={task.createdAt}
        />
        <div className="flex gap-2">
          <Button onClick={() => setIsEditSheetOpen(true)}>
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
          <Button
            plain
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

      <EntityProperties
        properties={[
          {
            label: 'Assignee',
            value: task.assignee,
            renderType: 'user',
            fieldType: 'combobox',
            placeholder: 'Select assignee...',
            options: {
              comboboxOptions: memberOptions,
            },
            onSave: (val: string) =>
              updateMutation.mutateAsync({ assignee: val || null }),
          },
          {
            label: 'Status',
            value: statusCfg.label,
            renderType: 'badge',
            fieldType: 'combobox',
            options: {
              badgeColor: statusCfg.color,
              comboboxOptions: taskStatuses.map((s) => ({
                value: s.value,
                label: s.label,
              })),
            },
            onSave: (val: string) =>
              updateMutation.mutateAsync({ status: val as any }),
          },
          {
            label: 'Completed',
            value: task.completedAt,
            renderType: 'date',
            fieldType: 'date',
            onSave: (val) => updateMutation.mutateAsync({ completedAt: val }),
          },
          {
            label: 'Parent Task',
            value: task.parentId
              ? (allTasks.find((t) => t.id === task.parentId)?.title ??
                String(task.parentId))
              : null,
            renderType: 'text',
            fieldType: 'combobox',
            placeholder: 'Select parent task...',
            options: {
              comboboxOptions: [
                { value: '', label: 'No parent (top-level)' },
                ...parentTaskOptions,
              ],
            },
            onSave: async (val: string) => {
              const parentId = val ? parseInt(val, 10) : null;
              await updateMutation.mutateAsync({ parentId });
            },
          },
        ]}
      />

      <Divider className="mt-8" />

      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <Subheading>Description</Subheading>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 min-h-32 bg-white dark:bg-zinc-900 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500">
          <Editor
            key={taskId}
            holder={`task-description-editor-${taskId}`}
            data={descriptionField.value}
            onChange={(val) => descriptionField.setValue(val)}
            placeholder="Add a detailed description..."
          />
        </div>
      </div>

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
                onClick={() => router.push(`/tasks/new?parentId=${task.id}`)}
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
      <ActivityTimeline
        entityType="task"
        entityId={taskId}
        currentUserId={currentUserId ?? undefined}
      />

      <Sheet open={isEditSheetOpen} onClose={setIsEditSheetOpen} side="right">
        <SheetHeader>
          <SheetTitle>Edit Task</SheetTitle>
          <Button plain onClick={() => setIsEditSheetOpen(false)}>
            <XMarkIcon className="h-5 w-5" />
          </Button>
        </SheetHeader>
        <TaskForm
          mode="edit"
          task={task}
          onSuccess={() => setIsEditSheetOpen(false)}
          onCancel={() => setIsEditSheetOpen(false)}
        />
      </Sheet>
    </>
  );
};

export default TaskDetail;
