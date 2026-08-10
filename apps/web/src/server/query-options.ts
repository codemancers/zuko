import { queryOptions, infiniteQueryOptions } from '@tanstack/react-query';
import { icpApi } from '@/lib/api/icp';
import type { ContactFilters } from '@/lib/api/contacts';
import { contactsApi } from '@/lib/api/contacts';
import type { CompanyFilters } from '@/lib/api/companies';
import { companiesApi } from '@/lib/api/companies';
import type { DealFilters } from '@/lib/api/deals';
import { dealsApi } from '@/lib/api/deals';
import type { TaskFilters } from '@/lib/api/tasks';
import { tasksApi } from '@/lib/api/tasks';
import { leadsApi } from '@/lib/api/leads';
import { activitiesApi } from '@/lib/api/activities';
import { pagesApi } from '@/lib/api/pages';
import { meetingsApi, type MeetingFilters } from '@/lib/api/meetings';
import { authClient } from '@/lib/auth-client';
import {
  apolloSequencesApi,
  apolloIntegrationApi,
  apolloProspectsApi,
} from '@/lib/api/apollo';

const TABLE_PAGE_SIZE = 10;

export const getContacts = (filters?: ContactFilters) =>
  queryOptions({
    queryKey: ['contacts', filters],
    queryFn: async () => {
      const response = await contactsApi.getContacts(filters);
      return response;
    },
  });

export const getTableViewContactsInfinite = (
  filters?: Omit<ContactFilters, 'page' | 'limit'>,
) =>
  infiniteQueryOptions({
    queryKey: ['contacts', 'table', 'infinite', filters],
    queryFn: ({ pageParam }) =>
      contactsApi.getTableViewContacts({
        ...filters,
        page: pageParam,
        limit: TABLE_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

export const getContact = (id: number) =>
  queryOptions({
    queryKey: ['contact', id],
    queryFn: async () => {
      return await contactsApi.getContact(id);
    },
  });

export const getCompanies = (filters?: CompanyFilters) =>
  queryOptions({
    queryKey: ['companies', filters],
    queryFn: async () => {
      const response = await companiesApi.getCompanies(filters);
      return response;
    },
  });

export const getTableViewCompaniesInfinite = (
  filters?: Omit<CompanyFilters, 'page' | 'limit'>,
) =>
  infiniteQueryOptions({
    queryKey: ['companies', 'table', 'infinite', filters],
    queryFn: ({ pageParam }) =>
      companiesApi.getTableViewCompanies({
        ...filters,
        page: pageParam,
        limit: TABLE_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

export const getCompany = (id: number) =>
  queryOptions({
    queryKey: ['company', id],
    queryFn: async () => {
      return await companiesApi.getCompany(id);
    },
  });

export const getDeals = (filters?: DealFilters) =>
  queryOptions({
    queryKey: ['deals', filters],
    queryFn: async () => {
      const response = await dealsApi.getDeals(filters);
      return response;
    },
  });

export const getTasks = (filters?: TaskFilters) =>
  queryOptions({
    queryKey: ['tasks', filters],
    queryFn: () => tasksApi.getTasks(filters),
  });

export const getTableViewTasksInfinite = (filters?: { search?: string }) =>
  infiniteQueryOptions({
    queryKey: ['tasks', 'table', 'infinite', filters],
    queryFn: ({ pageParam }) =>
      tasksApi.getTableViewTasks({
        ...filters,
        page: pageParam,
        limit: TABLE_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

export const getLead = (id: number) =>
  queryOptions({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.get(id),
  });

export const getTableViewLeadsInfinite = (filters?: {
  search?: string;
  status?: string;
}) =>
  infiniteQueryOptions({
    queryKey: ['leads', 'table', 'infinite', filters],
    queryFn: ({ pageParam }) =>
      leadsApi.getTableViewLeads({
        ...filters,
        page: pageParam,
        limit: TABLE_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

export const getTableViewMeetingsInfinite = (
  filters?: Omit<MeetingFilters, 'page' | 'limit'>,
) =>
  infiniteQueryOptions({
    queryKey: ['meetings', 'table', 'infinite', filters],
    queryFn: ({ pageParam }) =>
      meetingsApi.getTableViewMeetings({
        ...filters,
        page: pageParam,
        limit: TABLE_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

export const getTask = (id: number) =>
  queryOptions({
    queryKey: ['task', id],
    queryFn: () => tasksApi.getTask(id),
  });

export const getPages = queryOptions({
  queryKey: ['pages'],
  queryFn: () => pagesApi.getPages(),
});

export const getPage = (id: number) =>
  queryOptions({
    queryKey: ['pages', id],
    queryFn: () => pagesApi.getPage(id),
    staleTime: Infinity,
  });
export const getTableViewDealsInfinite = (
  filters?: Omit<DealFilters, 'page' | 'limit'>,
) =>
  infiniteQueryOptions({
    queryKey: ['deals', 'table', 'infinite', filters],
    queryFn: ({ pageParam }) =>
      dealsApi.getTableViewDeals({
        ...filters,
        page: pageParam,
        limit: TABLE_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
  });

export const getDeal = (id: number) =>
  queryOptions({
    queryKey: ['deal', id],
    queryFn: async () => {
      return await dealsApi.getDeal(id);
    },
  });

export const getDealsByContact = (contactId: number) =>
  queryOptions({
    queryKey: ['deals', 'contact', contactId],
    queryFn: async () => {
      const response = await dealsApi.getDealsByContact(contactId);
      return response;
    },
  });

export const getDealsByCompany = (companyId: number) =>
  queryOptions({
    queryKey: ['deals', 'company', companyId],
    queryFn: async () => {
      const response = await dealsApi.getDealsByCompany(companyId);
      return response;
    },
  });

export const getTimeline = (
  entityType: string,
  entityId: number,
  limit?: number,
) =>
  queryOptions({
    queryKey: ['timeline', entityType, entityId, limit],
    queryFn: async () => {
      const response = await activitiesApi.getTimeline(
        entityType,
        entityId,
        limit,
      );
      return response.activities;
    },
  });

export const getOrganizations = (headers?: HeadersInit) =>
  queryOptions({
    queryKey: ['organizations'],
    queryFn: async () => {
      const { data } = await authClient.organization.list({
        fetchOptions: {
          headers,
        },
      });
      return data || [];
    },
  });

export const getTeams = (organizationId: string) =>
  queryOptions({
    queryKey: ['organization', organizationId, 'teams'],
    queryFn: async () => {
      const { data } = await authClient.organization.listTeams({
        query: { organizationId },
      });
      return data || [];
    },
  });

export const getMembers = (organizationId: string) =>
  queryOptions({
    queryKey: ['organization', organizationId, 'members'],
    queryFn: async () => {
      const { data } = await authClient.organization.listMembers({
        query: { organizationId, limit: 100 },
      });
      return data?.members || [];
    },
  });

export const getInvitations = (organizationId: string) =>
  queryOptions({
    queryKey: ['organization', organizationId, 'invitations'],
    queryFn: async () => {
      const { data } = await authClient.organization.listInvitations({
        query: { organizationId },
      });
      return data || [];
    },
  });
export const getTeamMembers = (teamId: string) =>
  queryOptions({
    queryKey: ['team', teamId, 'members'],
    queryFn: async () => {
      const { data } = await authClient.organization.listTeamMembers({
        query: { teamId },
      });
      return data || [];
    },
  });

export const getUserInvitations = () =>
  queryOptions({
    queryKey: ['user', 'invitations'],
    queryFn: async () => {
      const { data } = await authClient.organization.listUserInvitations();
      return data || [];
    },
  });

export const getMeetings = queryOptions({
  queryKey: ['meetings'],
  queryFn: () => meetingsApi.getMeetings(),
});

export const getMeeting = (id: number) =>
  queryOptions({
    queryKey: ['meeting', id],
    queryFn: () => meetingsApi.getMeeting(id),
  });

export const getIcpProfilesInfinite = (perPage = 20) =>
  infiniteQueryOptions({
    queryKey: ['icp', 'profiles', 'infinite', perPage],
    queryFn: ({ pageParam }) => icpApi.listProfiles(pageParam, perPage),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });

/** @public */
export const getCampaignById = (id: string) =>
  queryOptions({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const result = await apolloSequencesApi.list({ page: 1, perPage: 100 });
      const campaign = result.emailer_campaigns.find((c) => c.id === id);
      if (!campaign) throw new Error('Campaign not found');
      return campaign;
    },
    retry: false,
  });

/** @public */
export const getCampaignsInfinite = (search?: string) =>
  infiniteQueryOptions({
    queryKey: ['campaigns', 'infinite', search],
    queryFn: ({ pageParam }) =>
      apolloSequencesApi.list({
        name: search,
        page: pageParam,
        perPage: TABLE_PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, total_pages } = lastPage.pagination;
      return page < total_pages ? page + 1 : undefined;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

export const getCampaignsByIcpProfile = (icpProfileId: number) =>
  queryOptions({
    queryKey: ['campaigns', 'by-icp', icpProfileId],
    queryFn: () => apolloSequencesApi.listByIcpProfile(icpProfileId),
  });

export const getAllZukoCampaigns = () =>
  queryOptions({
    queryKey: ['campaigns', 'zuko', 'all'],
    queryFn: () => apolloSequencesApi.listAll(),
    staleTime: 2 * 60 * 1000,
  });

export const getZukoCampaignByDbId = (id: number) =>
  queryOptions({
    queryKey: ['campaign', 'zuko-db', id],
    queryFn: () => apolloSequencesApi.getByZukoId(id),
    retry: false,
  });

export const getApolloUsageStats = () =>
  queryOptions({
    queryKey: ['apollo', 'usage-stats'],
    queryFn: () => apolloIntegrationApi.getUsageStats(),
    staleTime: 60_000, // refresh at most once per minute
    retry: false,
  });

export const getApolloConnectionStatus = () =>
  queryOptions({
    queryKey: ['apollo', 'connection-status'],
    queryFn: () => apolloIntegrationApi.getConnectionStatus(),
    staleTime: 30_000,
    retry: false,
  });

export const getProspectSearch = (params: {
  personName?: string;
  personTitles?: string[];
  personLocations?: string[];
  organizationIds?: string[];
  organizationDomains?: string[];
  page?: number;
}) =>
  queryOptions({
    queryKey: ['prospects', 'search', params],
    queryFn: () => apolloProspectsApi.search({ ...params, perPage: 25 }),
    enabled: Boolean(
      params.personName ||
      params.personTitles?.length ||
      params.personLocations?.length ||
      params.organizationIds?.length ||
      params.organizationDomains?.length,
    ),
    staleTime: 30_000,
    retry: false,
  });

export const getOrgSearch = (name: string) =>
  queryOptions({
    queryKey: ['apollo', 'orgs', 'search', name],
    queryFn: () => apolloProspectsApi.searchOrgs(name),
    enabled: name.trim().length >= 2,
    staleTime: 60_000,
    retry: false,
  });

export const getIcpProfile = (id: number) =>
  queryOptions({
    queryKey: ['icp', 'profile', id],
    queryFn: () => icpApi.getProfile(id),
  });
