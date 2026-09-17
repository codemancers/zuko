import { apiClient } from '../api-client';

/**
 * Prospect lifecycle types mirror libs/sales/src/lib/constants/prospects.ts —
 * see docs/concepts/prospect-lifecycle.mdx for what each value means.
 */
export type ProspectStatus =
  | 'new'
  | 'enrolled'
  | 'engaged'
  | 'promoted'
  | 'disqualified'
  | 'suppressed';

export type CampaignMembershipState =
  | 'identified'
  | 'enrolled'
  | 'active'
  | 'completed'
  | 'removed';

export type EngagementState =
  | 'not_contacted'
  | 'contacted'
  | 'responded'
  | 'no_response'
  | 'unreachable';

export type CampaignDisposition =
  | 'interested'
  | 'nurture'
  | 'disqualified'
  | 'opted_out';

export type ContactChannel = 'email' | 'linkedin' | 'phone';
export type ConsentState = 'unknown' | 'granted' | 'revoked';

export interface CampaignMembership {
  id: number;
  prospectId: number;
  campaignId: number;
  state: CampaignMembershipState;
  engagement: EngagementState;
  disposition: CampaignDisposition | null;
  enrolledAt: string | null;
  closedAt: string | null;
  createdAt: string;
  campaign?: { id: number; name: string; provider: string };
}

export interface CampaignEvent {
  id: number;
  membershipId: number;
  prospectId: number;
  eventType: string;
  occurredAt: string;
  externalId: string | null;
}

export interface Prospect {
  id: number;
  organizationId: number;
  icpProfileId: number | null;
  contactId: number | null;
  leadId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  title: string | null;
  linkedinUrl: string | null;
  apolloPersonId: string | null;
  status: ProspectStatus;
  source: string;
  emailConsent: ConsentState;
  linkedinConsent: ConsentState;
  phoneConsent: ConsentState;
  createdAt: string;
  updatedAt: string;
  icpProfile?: { id: number; name: string } | null;
  contact?: { id: number; name: string; email?: string } | null;
  lead?: { id: number; name: string; status: string } | null;
  memberships: CampaignMembership[];
}

export interface ProspectsListResponse {
  data: Prospect[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface ProspectStatusCount {
  status: ProspectStatus;
  count: number;
}

export interface ProspectFilters {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string[];
  engagement?: string[];
  campaignId?: number;
  icpProfileId?: number;
}

export interface CreateProspectDto {
  name: string;
  email?: string;
  phone?: string;
  companyName?: string;
  title?: string;
  linkedinUrl?: string;
  icpProfileId?: number;
  source?: string;
}

export const prospectsApi = {
  async list(filters: ProspectFilters = {}): Promise<ProspectsListResponse> {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.perPage) params.set('perPage', String(filters.perPage));
    if (filters.search) params.set('search', filters.search);
    if (filters.campaignId)
      params.set('campaignId', String(filters.campaignId));
    if (filters.icpProfileId)
      params.set('icpProfileId', String(filters.icpProfileId));
    filters.status?.forEach((s) => params.append('status', s));
    filters.engagement?.forEach((s) => params.append('engagement', s));
    const qs = params.toString();
    return apiClient.get(`/prospects${qs ? `?${qs}` : ''}`);
  },

  async stats(): Promise<ProspectStatusCount[]> {
    return apiClient.get('/prospects/stats');
  },

  async get(id: number): Promise<Prospect> {
    return apiClient.get(`/prospects/${id}`);
  },

  async events(id: number): Promise<CampaignEvent[]> {
    return apiClient.get(`/prospects/${id}/events`);
  },

  async create(dto: CreateProspectDto): Promise<Prospect> {
    return apiClient.post('/prospects', dto);
  },

  async enrol(id: number, campaignId: number): Promise<CampaignMembership> {
    return apiClient.post(`/prospects/${id}/enrol`, { campaignId });
  },

  async setStatus(
    id: number,
    status: ProspectStatus,
    manual = false,
  ): Promise<Prospect> {
    return apiClient.patch(`/prospects/${id}/status`, { status, manual });
  },

  async promote(id: number) {
    return apiClient.post(`/prospects/${id}/promote`, {});
  },

  async suppress(id: number): Promise<Prospect> {
    return apiClient.post(`/prospects/${id}/suppress`, {});
  },

  async setConsent(
    id: number,
    channel: ContactChannel,
    consent: ConsentState,
  ): Promise<Prospect> {
    return apiClient.patch(`/prospects/${id}/consent`, { channel, consent });
  },

  async setDisposition(
    membershipId: number,
    disposition: CampaignDisposition,
  ): Promise<CampaignMembership> {
    return apiClient.patch(
      `/prospects/memberships/${membershipId}/disposition`,
      { disposition },
    );
  },

  async recordEvent(
    membershipId: number,
    eventType: string,
  ): Promise<CampaignMembership> {
    return apiClient.post(`/prospects/memberships/${membershipId}/events`, {
      eventType,
    });
  },

  async delete(id: number): Promise<void> {
    return apiClient.delete(`/prospects/${id}`);
  },
};
