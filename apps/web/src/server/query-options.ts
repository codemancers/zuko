import { queryOptions } from '@tanstack/react-query';
import { contactsApi, ContactFilters } from '@/lib/api/contacts';
import { companiesApi, CompanyFilters } from '@/lib/api/companies';
import { dealsApi, DealFilters } from '@/lib/api/deals';
import { tasksApi, TaskFilters } from '@/lib/api/tasks';
import { activitiesApi } from '@/lib/api/activities';
import { meetingsApi, type MeetingFilters } from '@/lib/api/meetings';
import { authClient } from '@/lib/auth-client';

export const getContacts = (filters?: ContactFilters) =>
  queryOptions({
    queryKey: ['contacts', filters],
    queryFn: async () => {
      const response = await contactsApi.getContacts(filters);
      return response;
    },
  });

export const getTableViewContacts = (filters?: ContactFilters) =>
  queryOptions({
    queryKey: ['contacts', 'table', filters],
    queryFn: async () => {
      const response = await contactsApi.getTableViewContacts(filters);
      return response;
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

export const getTableViewCompanies = (filters?: CompanyFilters) =>
  queryOptions({
    queryKey: ['companies', 'table', filters],
    queryFn: async () => {
      const response = await companiesApi.getTableViewCompanies(filters);
      return response;
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

export const getTask = (id: number) =>
  queryOptions({
    queryKey: ['task', id],
    queryFn: () => tasksApi.getTask(id),
  });
export const getTableViewDeals = (filters?: DealFilters) =>
  queryOptions({
    queryKey: ['deals', 'table', filters],
    queryFn: async () => {
      const response = await dealsApi.getTableViewDeals(filters);
      return response;
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

export const getTableViewMeetings = (filters?: MeetingFilters) =>
  queryOptions({
    queryKey: ['meetings', 'table', filters],
    queryFn: () => meetingsApi.getTableViewMeetings(filters),
  });

export const getMeeting = (id: number) =>
  queryOptions({
    queryKey: ['meeting', id],
    queryFn: () => meetingsApi.getMeeting(id),
  });
