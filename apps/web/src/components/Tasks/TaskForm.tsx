'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Button,
  Field,
  FieldGroup,
  Fieldset,
  Input,
  Label,
  Select,
  Textarea,
  ErrorMessage,
} from '@zuko/ui-kit';
import { tasksApi, TaskStatus, type Task } from '@/lib/api/tasks';
import { getTasks } from '@/server/query-options';

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

const TaskForm = ({ mode, task, defaultParentId }: TaskFormProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'TODO');
  const [assignee, setAssignee] = useState(task?.assignee ?? '');
  const [parentId, setParentId] = useState<string>(
    String(task?.parentId ?? defaultParentId ?? ''),
  );
  const [error, setError] = useState('');

  const { data: tasksData } = useQuery(getTasks());
  const topLevelTasks = (tasksData?.tasks ?? []).filter(
    (t) => t.id !== task?.id,
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const parentIdNum = parentId ? parseInt(parentId, 10) : undefined;
      if (mode === 'create') {
        return tasksApi.createTask({
          title,
          description: description || undefined,
          status,
          assignee: assignee || undefined,
          parentId: parentIdNum,
        });
      } else {
        return tasksApi.updateTask(task!.id, {
          title,
          description: description || null,
          status,
          assignee: assignee || null,
          parentId: parentIdNum ?? null,
        });
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      if (mode === 'create') {
        router.push('/tasks');
      } else {
        router.push(`/tasks/${result.id}`);
      }
    },
    onError: (err: Error) => {
      setError(err.message || 'Something went wrong');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setError('');
    mutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit}>
      <Fieldset>
        <FieldGroup>
          <Field>
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              required
            />
          </Field>

          <Field>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </Field>

          <Field>
            <Label>Status</Label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label>Assignee</Label>
            <Input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Person responsible"
            />
          </Field>

          <Field>
            <Label>Parent Task</Label>
            <Select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">No parent (top-level)</option>
              {topLevelTasks.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.title}
                </option>
              ))}
            </Select>
          </Field>

          {error && <ErrorMessage>{error}</ErrorMessage>}

          <div className="flex gap-3">
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
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </FieldGroup>
      </Fieldset>
    </form>
  );
};

export default TaskForm;
