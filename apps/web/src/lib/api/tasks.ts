import { apiClient } from '../api-client';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface TaskOwner {
  id: number;
  taskId: number;
  userId: number;
  isPrimary: boolean;
  assignedAt: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

export interface Task {
  id: number;
  organizationId: number;
  title: string;
  description?: string | null;
  status: TaskStatus;
  completedAt?: string | null;
  parentId?: number | null;
  assignee?: string | null;
  owners: TaskOwner[];
  subtasks: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface TasksListResponse {
  tasks: Task[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  status?: TaskStatus;
  completedAt?: string;
  parentId?: number;
  assignee?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  completedAt?: string | null;
  parentId?: number | null;
  assignee?: string | null;
}

export interface TaskFilters {
  page?: number;
  limit?: number;
  parentId?: number | null;
}

export const tasksApi = {
  async getTasks(filters?: TaskFilters): Promise<TasksListResponse> {
    const params = new URLSearchParams();
    if (filters) {
      if (filters.page !== undefined) params.append('page', String(filters.page));
      if (filters.limit !== undefined) params.append('limit', String(filters.limit));
      if (filters.parentId !== undefined) {
        params.append('parentId', filters.parentId === null ? 'null' : String(filters.parentId));
      }
    }
    const qs = params.toString();
    return apiClient.get<TasksListResponse>(`/tasks${qs ? `?${qs}` : ''}`);
  },

  async getTask(id: number): Promise<Task> {
    return apiClient.get<Task>(`/tasks/${id}`);
  },

  async createTask(data: CreateTaskDto): Promise<Task> {
    return apiClient.post('/tasks', data);
  },

  async updateTask(id: number, data: UpdateTaskDto): Promise<Task> {
    return apiClient.patch(`/tasks/${id}`, data);
  },

  async deleteTask(id: number): Promise<void> {
    return apiClient.delete(`/tasks/${id}`);
  },
};
