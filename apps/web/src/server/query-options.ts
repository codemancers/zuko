import { queryOptions } from '@tanstack/react-query';
import { contactsApi, ContactFilters } from '@/lib/api/contacts';
import { companiesApi, CompanyFilters } from '@/lib/api/companies';
import { dealsApi, DealFilters } from '@/lib/api/deals';
import { activitiesApi } from '@/lib/api/activities';

export const getContacts = (filters?: ContactFilters) =>
  queryOptions({
    queryKey: ['contacts', filters],
    queryFn: async () => {
      const response = await contactsApi.getContacts(filters);
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
  limit?: number
) =>
  queryOptions({
    queryKey: ['timeline', entityType, entityId, limit],
    queryFn: async () => {
      const response = await activitiesApi.getTimeline(
        entityType,
        entityId,
        limit
      );
      return response.activities;
    },
  });
