import type { Task } from '@/lib/api/tasks';

export type AssigneeOption = {
  value: string;
  label: string;
  description?: string;
};

type OrgMember = {
  userId: string | number;
  user: { name: string; email: string };
};

type AssignedTask = Pick<Task, 'assignee' | 'assigneeUserId' | 'assigneeUser'>;

export const UNASSIGNED = '';
export const LEGACY_ASSIGNEE_NOTE = 'legacy name, not linked';

/** The task's legacy assignee name when it is not tied to a user. */
export function unresolvedLegacyAssignee(task?: AssignedTask) {
  return task?.assigneeUserId == null && task?.assignee ? task.assignee : null;
}

/** Name to display for the assignee; stable links show the user's current name. */
export function assigneeDisplayName(task: AssignedTask) {
  if (task.assigneeUserId != null) {
    return task.assigneeUser?.name ?? task.assignee ?? null;
  }
  const legacy = unresolvedLegacyAssignee(task);
  return legacy ? `${legacy} (${LEGACY_ASSIGNEE_NOTE})` : null;
}

/**
 * Member options keyed by user ID (not Member.id). Email is included so
 * members sharing a name stay distinguishable. A linked assignee who is no
 * longer listed is kept so the current selection still renders.
 */
export function assigneeOptions(
  members: OrgMember[],
  task?: AssignedTask,
): AssigneeOption[] {
  const options: AssigneeOption[] = [
    { value: UNASSIGNED, label: 'Unassigned' },
    ...members.map((m) => ({
      value: String(m.userId),
      label: m.user.name,
      description: m.user.email,
    })),
  ];
  const current = task?.assigneeUser;
  if (current && !options.some((o) => o.value === String(current.id))) {
    options.push({
      value: String(current.id),
      label: current.name,
      description: current.email,
    });
  }
  return options;
}
