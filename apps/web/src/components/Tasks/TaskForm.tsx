'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Field,
  FieldGroup,
  Fieldset,
  Input,
  Label,
  Select,
  ErrorMessage,
  Combobox,
  ComboboxOption,
  ComboboxLabel,
} from '@zuko/ui-kit';
import { FormActions } from '@/components/shared';
import { tasksApi, type Task, type TaskStatus } from '@/lib/api/tasks';
import { toast } from 'sonner';
import { getTasks, getMembers } from '@/server/query-options';
import Editor, { ensureOutputData } from '@/components/Common/Editor/Editor';
import { authClient } from '@/lib/auth-client';

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.any().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
  assignee: z.string().optional(),
  parentId: z.string(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  mode: 'create' | 'edit';
  task?: Task;
  defaultParentId?: number;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

type MemberOption = { value: string; label: string };

const TaskForm = ({ mode, task, defaultParentId }: TaskFormProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const activeOrg = authClient.useActiveOrganization();
  const orgId = activeOrg.data?.id ?? '';
  const { data: members = [] } = useQuery({
    ...getMembers(orgId),
    enabled: !!orgId,
  });

  const memberOptions: MemberOption[] = [
    { value: '', label: 'Unassigned' },
    ...members.map((m) => ({ value: m.user.name, label: m.user.name })),
  ];

  const { data: tasksData } = useQuery(getTasks());
  const topLevelTasks = (tasksData?.tasks ?? []).filter(
    (t) => t.id !== task?.id,
  );

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title ?? '',
      description: task?.description ?? '',
      status: task?.status ?? 'TODO',
      assignee: task?.assignee ?? '',
      parentId: String(task?.parentId ?? defaultParentId ?? ''),
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: TaskFormValues) => {
      const parentIdNum = data.parentId
        ? parseInt(data.parentId, 10)
        : undefined;
      if (mode === 'create') {
        return tasksApi.createTask({
          title: data.title,
          description: data.description || undefined,
          status: data.status,
          assignee: data.assignee || undefined,
          parentId: parentIdNum,
        });
      } else {
        if (!task) throw new Error('Task required in edit mode');
        return tasksApi.updateTask(task.id, {
          title: data.title,
          description: data.description || null,
          status: data.status,
          assignee: data.assignee || null,
          parentId: parentIdNum ?? null,
        });
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (mode === 'create') {
        if (result.parentId) {
          queryClient.invalidateQueries({
            queryKey: ['timeline', 'task', result.parentId],
          });
        }
        toast.success('Task created successfully');
        router.push('/tasks');
      } else {
        queryClient.invalidateQueries({
          queryKey: ['timeline', 'task', result.id],
        });
        toast.success('Task updated successfully');
        router.push(`/tasks/${result.id}`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Something went wrong');
      form.setError('root', {
        type: 'manual',
        message: err.message || 'Something went wrong',
      });
    },
  });

  const onSubmit = (data: TaskFormValues) => {
    mutation.mutate(data);
  };

  const handleCancel = () => {
    if (mode === 'create' || !task) {
      router.push('/tasks');
    } else {
      router.push(`/tasks/${task.id}`);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <Fieldset>
        <FieldGroup>
          <Field>
            <Label>Title *</Label>
            <Input
              placeholder="Task title"
              {...form.register('title')}
              disabled={mutation.isPending}
            />
            {form.formState.errors.title && (
              <ErrorMessage>{form.formState.errors.title.message}</ErrorMessage>
            )}
          </Field>

          <Field>
            <Label>Description</Label>
            <Controller
              control={form.control}
              name="description"
              render={({ field }) => (
                <div
                  data-slot="control"
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 min-h-32 bg-white dark:bg-zinc-900 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500"
                >
                  <Editor
                    holder="task-description-editor"
                    data={ensureOutputData(field.value)}
                    onChange={(val) => field.onChange(val)}
                    placeholder="Optional description"
                  />
                </div>
              )}
            />
          </Field>

          <Field>
            <Label>Status</Label>
            <Select {...form.register('status')} disabled={mutation.isPending}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            {form.formState.errors.status && (
              <ErrorMessage>
                {form.formState.errors.status.message}
              </ErrorMessage>
            )}
          </Field>

          <Field>
            <Label>Assignee</Label>
            <Controller
              control={form.control}
              name="assignee"
              render={({ field }) => (
                <Combobox<MemberOption>
                  options={memberOptions}
                  value={
                    memberOptions.find((o) => o.value === field.value) ??
                    undefined
                  }
                  displayValue={(opt) => opt?.label ?? ''}
                  onChange={(opt) => field.onChange(opt?.value ?? '')}
                  placeholder="Select assignee..."
                  disabled={mutation.isPending}
                >
                  {(option) => (
                    <ComboboxOption key={option.value || 'none'} value={option}>
                      <ComboboxLabel>{option.label}</ComboboxLabel>
                    </ComboboxOption>
                  )}
                </Combobox>
              )}
            />
          </Field>

          <Field>
            <Label>Parent Task</Label>
            <Controller
              control={form.control}
              name="parentId"
              render={({ field }) => (
                <Select
                  {...field}
                  value={field.value}
                  disabled={mutation.isPending}
                >
                  <option value="">No parent (top-level)</option>
                  {topLevelTasks.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.title}
                    </option>
                  ))}
                </Select>
              )}
            />
          </Field>

          {form.formState.errors.root && (
            <ErrorMessage>{form.formState.errors.root.message}</ErrorMessage>
          )}

          <FormActions
            isLoading={mutation.isPending}
            submitLabel={mode === 'create' ? 'Create Task' : 'Save Changes'}
            loadingLabel={mode === 'create' ? 'Creating...' : 'Saving...'}
            onCancel={handleCancel}
          />
        </FieldGroup>
      </Fieldset>
    </form>
  );
};

export default TaskForm;
