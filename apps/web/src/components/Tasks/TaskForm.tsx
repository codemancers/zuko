'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Checkbox,
  CheckboxField,
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
  ComboboxDescription,
  SheetFooter,
  Button,
} from '@zuko/ui-kit';
import { FormActions } from '@/components/shared';
import {
  tasksApi,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from '@/lib/api/tasks';
import { toast } from 'sonner';
import { getTasks, getMembers } from '@/server/query-options';
import Editor, { ensureOutputData } from '@/components/Common/Editor/Editor';
import { authClient } from '@/lib/auth-client';
import clsx from 'clsx';
import { TaskPersonField, type TaskPerson } from './TaskPersonField';
import {
  type AssigneeOption,
  UNASSIGNED,
  assigneeOptions,
  unresolvedLegacyAssignee,
} from './assignee';

const taskFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.any().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assignee: z.string().optional(),
  parentId: z.string(),
  isSales: z.boolean(),
  dueDate: z.string(),
  person: z
    .object({
      type: z.enum(['contact', 'prospect']),
      id: z.number(),
      name: z.string(),
    })
    .nullable(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskFormProps {
  mode: 'create' | 'edit';
  task?: Task;
  defaultParentId?: number;
  defaultIsSales?: boolean;
  defaultDueDate?: string;
  defaultAssigneeUserId?: number;
  defaultPerson?: TaskPerson;
  onSuccess?: () => void;
  onCancel?: () => void;
  onSavingChange?: (saving: boolean) => void;
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

// Form value standing for an unresolved legacy name kept as-is.
const LEGACY_VALUE = 'legacy';

const TaskForm = ({
  mode,
  task,
  defaultParentId,
  defaultIsSales = false,
  defaultDueDate = '',
  defaultAssigneeUserId,
  defaultPerson,
  onSuccess,
  onCancel,
  onSavingChange,
}: TaskFormProps) => {
  const router = useRouter();
  const submitting = useRef(false);
  const queryClient = useQueryClient();

  const activeOrg = authClient.useActiveOrganization();
  const orgId = activeOrg.data?.id ?? '';
  const { data: members = [] } = useQuery({
    ...getMembers(orgId),
    enabled: !!orgId,
  });

  const legacyAssignee = unresolvedLegacyAssignee(task);
  const memberOptions = assigneeOptions(members, task);
  if (legacyAssignee) {
    memberOptions.splice(1, 0, {
      value: LEGACY_VALUE,
      label: legacyAssignee,
      description: 'Legacy name, not linked to a member',
    });
  }
  const initialAssignee =
    task?.assigneeUserId != null
      ? String(task.assigneeUserId)
      : legacyAssignee
        ? LEGACY_VALUE
        : mode === 'create' && defaultAssigneeUserId != null
          ? String(defaultAssigneeUserId)
          : UNASSIGNED;

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
      priority: task?.priority ?? 'MEDIUM',
      isSales: mode === 'edit' ? (task?.isSales ?? false) : defaultIsSales,
      dueDate: mode === 'edit' ? (task?.dueDate ?? '') : defaultDueDate,
      person:
        mode === 'create'
          ? (defaultPerson ?? null)
          : task?.contactId
            ? {
                type: 'contact',
                id: task.contactId,
                name: task.contact?.name ?? `Contact #${task.contactId}`,
              }
            : task?.prospectId
              ? {
                  type: 'prospect',
                  id: task.prospectId,
                  name: task.prospect?.name ?? `Prospect #${task.prospectId}`,
                }
              : null,
      assignee: initialAssignee,
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
          priority: data.priority,
          isSales: data.isSales,
          dueDate: data.dueDate || null,
          contactId: data.person?.type === 'contact' ? data.person.id : null,
          prospectId: data.person?.type === 'prospect' ? data.person.id : null,
          assigneeUserId: data.assignee ? Number(data.assignee) : undefined,
          parentId: parentIdNum,
        });
      } else {
        if (!task) throw new Error('Task required in edit mode');
        // Only send assignment when it changed, so an unresolved legacy
        // name survives edits to other fields.
        const assignment =
          data.assignee === initialAssignee
            ? {}
            : { assigneeUserId: data.assignee ? Number(data.assignee) : null };
        const contactId =
          data.person?.type === 'contact' ? data.person.id : null;
        const prospectId =
          data.person?.type === 'prospect' ? data.person.id : null;
        // Preserve existing references (including hidden people) on unrelated edits.
        const person =
          contactId === (task.contactId ?? null) &&
          prospectId === (task.prospectId ?? null)
            ? {}
            : { contactId, prospectId };
        return tasksApi.updateTask(task.id, {
          title: data.title,
          description: data.description || null,
          status: data.status,
          priority: data.priority,
          isSales: data.isSales,
          dueDate: data.dueDate || null,
          ...person,
          ...assignment,
          parentId: parentIdNum ?? null,
        });
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (mode === 'create') {
        if (result.parentId) {
          queryClient.invalidateQueries({
            queryKey: ['task', result.parentId],
          });
          queryClient.invalidateQueries({
            queryKey: ['timeline', 'task', result.parentId],
          });
        }
        toast.success('Task created successfully');
        if (onSuccess) {
          onSuccess();
        } else {
          router.push('/tasks');
        }
      } else {
        queryClient.invalidateQueries({ queryKey: ['task', result.id] });
        queryClient.invalidateQueries({
          queryKey: ['timeline', 'task', result.id],
        });
        toast.success('Task updated successfully');
        if (onSuccess) {
          onSuccess();
        } else {
          router.push(`/tasks/${result.id}`);
        }
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

  const onSubmit = async (data: TaskFormValues) => {
    if (submitting.current) return;
    submitting.current = true;
    onSavingChange?.(true);
    try {
      await mutation.mutateAsync(data);
    } catch {
      // onError displays the failure without resetting the form.
    } finally {
      submitting.current = false;
      onSavingChange?.(false);
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
      return;
    }
    if (mode === 'create' || !task) {
      router.push('/tasks');
    } else {
      router.push(`/tasks/${task.id}`);
    }
  };

  const isSheet = !!onSuccess;
  const advancedFields = (
    <>
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
          <ErrorMessage>{form.formState.errors.status.message}</ErrorMessage>
        )}
      </Field>

      <Field>
        <Label>Priority</Label>
        <Select {...form.register('priority')} disabled={mutation.isPending}>
          {PRIORITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        {form.formState.errors.priority && (
          <ErrorMessage>{form.formState.errors.priority.message}</ErrorMessage>
        )}
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
    </>
  );

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className={clsx(isSheet ? 'flex flex-1 min-h-0 flex-col' : 'space-y-6')}
    >
      <Fieldset
        className={clsx(
          isSheet ? 'flex-1 overflow-y-auto p-6 space-y-6' : 'contents',
        )}
      >
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
            <Label>Due date</Label>
            <Input
              type="date"
              {...form.register('dueDate')}
              disabled={mutation.isPending}
            />
          </Field>

          <Field>
            <Label>Assignee</Label>
            <Controller
              control={form.control}
              name="assignee"
              render={({ field }) => (
                <Combobox<AssigneeOption>
                  options={memberOptions}
                  value={
                    memberOptions.find((o) => o.value === field.value) ??
                    undefined
                  }
                  displayValue={(opt) =>
                    opt?.description
                      ? `${opt.label} (${opt.description})`
                      : (opt?.label ?? '')
                  }
                  onChange={(opt) => field.onChange(opt?.value ?? '')}
                  placeholder="Select assignee..."
                  disabled={mutation.isPending}
                >
                  {(option) => (
                    <ComboboxOption key={option.value || 'none'} value={option}>
                      <ComboboxLabel>{option.label}</ComboboxLabel>
                      {option.description && (
                        <ComboboxDescription>
                          {option.description}
                        </ComboboxDescription>
                      )}
                    </ComboboxOption>
                  )}
                </Combobox>
              )}
            />
          </Field>

          <CheckboxField>
            <Controller
              control={form.control}
              name="isSales"
              render={({ field }) => (
                <Checkbox
                  name={field.name}
                  checked={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={mutation.isPending}
                />
              )}
            />
            <Label>Sales task</Label>
          </CheckboxField>

          <Controller
            control={form.control}
            name="person"
            render={({ field }) => (
              <TaskPersonField
                value={field.value}
                onChange={field.onChange}
                organizationId={orgId}
                disabled={mutation.isPending}
              />
            )}
          />

          <Field>
            <Label>Description</Label>
            <Controller
              control={form.control}
              name="description"
              render={({ field }) => (
                <div
                  data-slot="control"
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 min-h-20 max-h-32 overflow-y-auto bg-white dark:bg-zinc-900 shadow-sm transition-[box-shadow,border-color] duration-150 ease-out focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500"
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

          {mode === 'create' && defaultIsSales ? (
            <details>
              <summary className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
                More options
              </summary>
              <FieldGroup className="mt-4">{advancedFields}</FieldGroup>
            </details>
          ) : (
            advancedFields
          )}

          {form.formState.errors.root && (
            <ErrorMessage>{form.formState.errors.root.message}</ErrorMessage>
          )}

          {!isSheet && (
            <FormActions
              isLoading={mutation.isPending}
              submitLabel={mode === 'create' ? 'Create Task' : 'Save Changes'}
              loadingLabel={mode === 'create' ? 'Creating...' : 'Saving...'}
              onCancel={handleCancel}
            />
          )}
        </FieldGroup>
      </Fieldset>

      {isSheet && (
        <SheetFooter>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending
              ? mode === 'create'
                ? 'Creating...'
                : 'Saving...'
              : mode === 'create'
                ? 'Create Task'
                : 'Save Changes'}
          </Button>
          <Button
            type="button"
            plain
            onClick={handleCancel}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
        </SheetFooter>
      )}
    </form>
  );
};

export default TaskForm;
