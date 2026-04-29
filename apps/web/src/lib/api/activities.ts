/**
 * Activities API client
 * Type-safe methods for timeline and activity operations
 */

import { apiClient } from '../api-client';

export interface Activity {
  id: number;
  activityType: string;
  entityType: string;
  entityId: number;
  actorId: number | null;
  content: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  actor: {
    id: number;
    name: string;
    email: string;
    image: string | null;
  } | null;
}

export interface ActivitiesListResponse {
  activities: Activity[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface ActivityFilters {
  entityType?: string;
  entityId?: number;
  activityType?: string;
  limit?: number;
  offset?: number;
}

export interface CreateCommentDto {
  content: string;
  userId: number;
}

export interface UpdateCommentDto {
  content: string;
  userId: number;
}

export const activitiesApi = {
  /**
   * Get all activities with optional filters
   */
  async getActivities(
    filters?: ActivityFilters,
  ): Promise<ActivitiesListResponse> {
    const params = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });
    }

    const queryString = params.toString();
    return apiClient.get(`/activities${queryString ? `?${queryString}` : ''}`);
  },

  /**
   * Get a single activity by ID
   */
  async getActivity(id: number): Promise<Activity> {
    return apiClient.get(`/activities/${id}`);
  },

  /**
   * Get timeline for a specific entity
   */
  async getTimeline(
    entityType: string,
    entityId: number,
    limit?: number,
  ): Promise<ActivitiesListResponse> {
    const params = new URLSearchParams();
    if (limit) {
      params.append('limit', limit.toString());
    }

    const queryString = params.toString();
    const pluralEntity =
      entityType === 'company' ? 'companies' : `${entityType}s`;
    return apiClient.get(
      `/${pluralEntity}/${entityId}/activities${queryString ? `?${queryString}` : ''}`,
    );
  },

  /**
   * Create a comment on an entity
   */
  async createComment(
    entityType: string,
    entityId: number,
    data: CreateCommentDto,
  ): Promise<Activity> {
    const pluralEntity =
      entityType === 'company' ? 'companies' : `${entityType}s`;
    return apiClient.post(
      `/${pluralEntity}/${entityId}/activities/comments`,
      data,
    );
  },

  /**
   * Delete an activity
   */
  async deleteActivity(id: number, userId: number): Promise<void> {
    return apiClient.delete(`/activities/${id}`, { userId });
  },

  /**
   * Update an activity (comment)
   */
  async updateActivity(id: number, data: UpdateCommentDto): Promise<Activity> {
    return apiClient.patch(`/activities/${id}`, data);
  },
};
