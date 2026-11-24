import { queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ObjectSummary {
  id: string;
  name: string;
  label: string;
  plural_label: string;
  object_kind: 'STANDARD' | 'CUSTOM';
  field_count: number;
}

export const objectListQuery = queryOptions({
  queryKey: ['objects'],
  queryFn: ({ signal }) => api<{ results: ObjectSummary[] }>('/api/v1/objects', { signal }),
});

export const permissionsQuery = queryOptions({
  queryKey: ['permissions'],
  queryFn: ({ signal }) => api<{ can_manage_objects: boolean }>('/api/v1/me', { signal }),
});
