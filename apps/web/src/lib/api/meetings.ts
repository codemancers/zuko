import { apiClient } from '../api-client';
import type { TableViewResponse } from '@/types/table-metadata';
import type { BaseRow } from '@/components/Table';

export type MeetingStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED';

export type MeetingPlatform = 'GOOGLE_MEET' | 'ZOOM' | 'MS_TEAMS';

export interface TranscriptData {
  text: string;
  is_final: boolean;
  speech_final: boolean;
  confidence: number;
  timestamp: string;
  speaker: number;
  speaker_name?: string;
  duration_seconds: number;
  formatted_duration: string;
}

export interface ChatMessage {
  user?: {
    fullName?: string;
    profilePicture?: string;
  };
  text?: string | null;
}

export interface MeetingSummary {
  id: number;
  meetingId: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingActionItem {
  id: number;
  meetingId: number;
  title: string;
  description: string | null;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Meeting {
  id: number;
  name: string | null;
  description: string | null;
  url: string;
  platform: MeetingPlatform;
  status: MeetingStatus;
  scheduledAt: string | null;
  timezone: string;
  recording: string | null;
  recordingUrl: string | null;
  transcript: string | null;
  createdAt: string;
  updatedAt: string;
  summaries: MeetingSummary[];
  actionItems: MeetingActionItem[];
  transcriptData: TranscriptData[] | null;
  chatMessages: ChatMessage[] | null;
  projectName?: string | null;
}

export type TableViewMeetingsResponse = TableViewResponse<BaseRow>;

export interface MeetingFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateMeetingDto {
  url: string;
  name?: string;
  description?: string;
  scheduledAt?: string;
  timezone?: string;
}

export const meetingsApi = {
  getMeetings: (): Promise<Meeting[]> => apiClient.get('/meetings'),

  getTableViewMeetings: (
    filters?: MeetingFilters,
  ): Promise<TableViewMeetingsResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page !== undefined) params.append('page', String(filters.page));
    if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
    const queryString = params.toString();
    return apiClient.get(
      `/tables/meetings${queryString ? `?${queryString}` : ''}`,
    );
  },

  getMeeting: (id: number): Promise<Meeting> =>
    apiClient.get(`/meetings/${id}`),

  createMeeting: (data: CreateMeetingDto): Promise<{ meeting: Meeting }> =>
    apiClient.post('/meetings', data),

  updateMeeting: (
    id: number,
    data: Partial<CreateMeetingDto>,
  ): Promise<Meeting> => apiClient.patch(`/meetings/${id}`, data),

  deleteMeeting: (id: number): Promise<void> =>
    apiClient.delete(`/meetings/${id}`),

  endMeeting: (id: number): Promise<{ message: string; meetingId: string }> =>
    apiClient.post(`/meetings/${id}/end`),

  updateActionItem: (
    actionItemId: number,
    data: { taskId?: string; title?: string; description?: string | null },
  ): Promise<{ success: boolean; actionItem: MeetingActionItem }> =>
    apiClient.patch(`/meetings/action-items/${actionItemId}`, data),
};
