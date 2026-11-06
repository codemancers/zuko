import { ApiError, ORGANIZATION_ID_HEADER } from '@/lib/api-client';
import type { Task, TasksListResponse } from './tasks';

export type AttentionTask = Pick<
  Task,
  | 'id'
  | 'title'
  | 'status'
  | 'priority'
  | 'parentId'
  | 'contactId'
  | 'prospectId'
> & {
  dueDate: string;
  assigneeUserId: number;
  assigneeUser: { id: number; name: string };
};
export interface NeedsAttentionResponse {
  tasks: AttentionTask[];
  pagination: TasksListResponse['pagination'];
}

/** Browser-only query. Pin the org header to its cache key rather than the
 * mutable apiClient singleton, so an in-flight org switch cannot mis-key data. */
export async function getNeedsAttention(
  organizationId: number,
  date: string,
  page: number,
  signal?: AbortSignal,
): Promise<NeedsAttentionResponse> {
  const params = new URLSearchParams({ date, page: String(page), limit: '10' });
  const response = await fetch(
    `/api/proxy/api/sales-overview/needs-attention?${params}`,
    {
      credentials: 'include',
      cache: 'no-store',
      signal,
      headers: { [ORGANIZATION_ID_HEADER]: String(organizationId) },
    },
  );
  if (!response.ok)
    throw new ApiError(
      'Unable to load tasks needing attention',
      response.status,
    );
  return response.json();
}
