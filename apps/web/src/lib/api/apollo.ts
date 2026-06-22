import { apiClient } from '../api-client';

// ─── API Usage Stats ─────────────────────────────────────────────────────────

export interface ApolloApiUsageStat {
  duration: 'minute' | 'hour' | 'day';
  calls_made: number;
  calls_limit: number;
}

export interface ApolloApiUsageStats {
  api_rate_limit_params: ApolloApiUsageStat[];
}

// ─── Connection ───────────────────────────────────────────────────────────────

export interface ApolloConnectionStatus {
  connected: boolean;
  connectedAt?: string;
  connectedByEmail?: string;
}

export interface ApolloAuthorizationUrl {
  url: string;
}

// ─── Sequences (list) ─────────────────────────────────────────────────────────

export interface ApolloSequence {
  id: string;
  name: string;
  active: boolean;
  num_steps: number;
  open_rate: number | string;
  reply_rate: number | string;
  unique_delivered: number | string;
  unique_opened?: number | string;
  bounce_rate?: number | string;
  click_rate?: number | string;
  opt_out_rate?: number | string;
  created_at: string;
}

export interface ApolloSequencesResponse {
  emailer_campaigns: ApolloSequence[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

// ─── Zuko Campaign (stored in DB) ────────────────────────────────────────────

export interface ZukoCampaignStep {
  id: string;
  type: string;
  position: number;
  wait_time: number;
  wait_mode: string;
  note?: string;
  priority?: string;
  auto_skip_in_x_days?: number;
  max_emails_per_day?: number;
  emailer_touches: Array<{
    id: string;
    emailer_template_id: string;
    type: string;
    status: string;
    include_signature: boolean;
    has_personalized_opener: boolean;
    personalized_opener_fallback_option?: string;
    generic_personalized_opener?: string;
    emailer_template?: {
      id: string;
      subject?: string;
      body_html: string;
    };
  }>;
}

export interface ZukoCampaign {
  id: number;
  organizationId: number;
  name: string;
  provider: string;
  providerSequenceId: string;
  active: boolean;
  permissions: string;
  sequence: ZukoCampaignStep[];
  createdAt: string;
  updatedAt: string;
}

// ─── Schedules ────────────────────────────────────────────────────────────────

export interface ApolloSchedule {
  id: string;
  name: string;
  default: boolean;
  time_zone: string;
}

export interface ApolloSchedulesResponse {
  emailer_schedules: ApolloSchedule[];
}

// ─── Sequence create ──────────────────────────────────────────────────────────

export interface CreateSequenceEmailerTemplate {
  subject?: string;
  bodyHtml: string;
}

export interface CreateSequenceTouch {
  apolloTouchId?: string;
  apolloTemplateId?: string;
  type: 'new_thread' | 'reply_to_thread';
  emailerTemplate: CreateSequenceEmailerTemplate;
  includeSignature?: boolean;
  status?: 'approved' | 'to_be_reviewed';
  hasPersonalizedOpener?: boolean;
  genericPersonalizedOpener?: string;
  personalizedOpenerFallbackOption?: 'skip' | 'use_generic';
}

export interface CreateSequenceStep {
  apolloStepId?: string;
  type: 'auto_email' | 'manual_email';
  waitTime: number;
  waitMode?: 'day' | 'hour' | 'minute';
  note?: string;
  priority?: 'low' | 'medium' | 'high';
  autoSkipInXDays?: number;
  maxEmailsPerDay?: number;
  touches: CreateSequenceTouch[];
}

export interface CreateSequencePayload {
  name: string;
  permissions?: 'private' | 'team_can_view' | 'team_can_use';
  emailerScheduleId?: string;
  labelNames?: string[];
  sequence: CreateSequenceStep[];
}

// ─── API clients ──────────────────────────────────────────────────────────────

export const apolloSequencesApi = {
  async list(params?: {
    name?: string;
    page?: number;
    perPage?: number;
  }): Promise<ApolloSequencesResponse> {
    const query = new URLSearchParams();
    if (params?.name) query.set('name', params.name);
    if (params?.page) query.set('page', String(params.page));
    if (params?.perPage) query.set('perPage', String(params.perPage));
    const qs = query.toString();
    return apiClient.get(`/integrations/apollo/sequences${qs ? `?${qs}` : ''}`);
  },

  async getSchedules(): Promise<ApolloSchedulesResponse> {
    return apiClient.get('/integrations/apollo/sequences/schedules');
  },

  async create(
    payload: CreateSequencePayload,
  ): Promise<{ emailer_campaign: ApolloSequence }> {
    return apiClient.post('/integrations/apollo/sequences', payload);
  },

  async approve(sequenceId: string): Promise<void> {
    return apiClient.post(
      `/integrations/apollo/sequences/${sequenceId}/approve`,
    );
  },

  async update(
    sequenceId: string,
    payload: CreateSequencePayload,
  ): Promise<void> {
    return apiClient.put(
      `/integrations/apollo/sequences/${sequenceId}`,
      payload,
    );
  },

  async deactivate(sequenceId: string): Promise<void> {
    return apiClient.post(
      `/integrations/apollo/sequences/${sequenceId}/deactivate`,
    );
  },

  async getCampaign(sequenceId: string): Promise<ZukoCampaign> {
    return apiClient.get(
      `/integrations/apollo/sequences/${sequenceId}/campaign`,
    );
  },
};

// ─── Prospects ────────────────────────────────────────────────────────────────

export interface ProspectPerson {
  id: string;
  /** Set when the person already exists as a CRM contact. */
  contactId?: string;
  isContact: boolean;
  name: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  city?: string;
  state?: string;
  country?: string;
  photoUrl?: string;
  linkedinUrl?: string;
  organizationName?: string;
  organization?: {
    id?: string;
    name?: string;
    primaryDomain?: string;
  };
}

export interface ProspectsSearchResponse {
  people: ProspectPerson[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

export interface OrgSearchResult {
  id: string;
  name: string;
}

export interface SearchProspectsParams {
  personName?: string;
  personTitles?: string[];
  personLocations?: string[];
  organizationIds?: string[];
  page?: number;
  perPage?: number;
}

export interface AddPeopleToSequencePayload {
  sequenceId: string;
  /** IDs of people that are already CRM contacts. */
  contactIds: string[];
  /** Apollo person IDs for prospects not yet in the CRM. */
  personIds: string[];
  /** Minimal data used to materialize prospects into contacts. */
  personData: Array<{
    firstName?: string;
    lastName?: string;
    organizationName?: string;
  }>;
}

export interface AddPeopleToSequenceResponse {
  result: unknown;
  failedPersonIds: string[];
}

export const apolloProspectsApi = {
  async search(
    params: SearchProspectsParams,
  ): Promise<ProspectsSearchResponse> {
    return apiClient.post('/integrations/apollo/prospects/search', params);
  },

  async searchOrgs(name: string): Promise<OrgSearchResult[]> {
    return apiClient.get(
      `/integrations/apollo/organizations/search?name=${encodeURIComponent(name)}`,
    );
  },

  async addToSequence(
    payload: AddPeopleToSequencePayload,
  ): Promise<AddPeopleToSequenceResponse> {
    return apiClient.post(
      '/integrations/apollo/prospects/add-to-sequence',
      payload,
    );
  },
};

export const apolloIntegrationApi = {
  async getConnectionStatus(): Promise<ApolloConnectionStatus> {
    return apiClient.get('/integrations/apollo/status');
  },

  async getAuthorizationUrl(): Promise<ApolloAuthorizationUrl> {
    return apiClient.get('/integrations/apollo/authorize');
  },

  async getUsageStats(): Promise<ApolloApiUsageStats> {
    return apiClient.get('/integrations/apollo/usage-stats');
  },

  async disconnect(): Promise<void> {
    return apiClient.delete('/integrations/apollo/disconnect');
  },
};
