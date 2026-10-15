export const TASK_STATUSES = [
  { label: 'To Do', value: 'TODO' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Done', value: 'DONE' },
  { label: 'Cancelled', value: 'CANCELLED' },
] as const;

export const TASK_STATUS_VALUES: string[] = TASK_STATUSES.map(
  (s) => s.value as string,
);

export const TASK_PRIORITIES = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' },
] as const;

export const TASK_PRIORITY_VALUES: string[] = TASK_PRIORITIES.map(
  (p) => p.value as string,
);
