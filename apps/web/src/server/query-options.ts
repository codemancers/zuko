import { queryOptions } from "@tanstack/react-query";
import { contactsApi, ContactFilters } from "@/lib/api/contacts";
import { accountsApi, AccountFilters } from "@/lib/api/accounts";
import { dealsApi, DealFilters } from "@/lib/api/deals";
import { activitiesApi } from "@/lib/api/activities";

export const getContacts = (filters?: ContactFilters) =>
  queryOptions({
    queryKey: ["contacts", filters],
    queryFn: async () => {
      const response = await contactsApi.getContacts(filters);
      return response;
    },
  });

export const getContact = (id: number) =>
  queryOptions({
    queryKey: ["contact", id],
    queryFn: async () => {
      return await contactsApi.getContact(id);
    },
  });

export const getAccounts = (filters?: AccountFilters) =>
  queryOptions({
    queryKey: ["accounts", filters],
    queryFn: async () => {
      const response = await accountsApi.getAccounts(filters);
      return response;
    },
  });

export const getAccount = (id: number) =>
  queryOptions({
    queryKey: ["account", id],
    queryFn: async () => {
      return await accountsApi.getAccount(id);
    },
  });

export const getDeals = (filters?: DealFilters) =>
  queryOptions({
    queryKey: ["deals", filters],
    queryFn: async () => {
      const response = await dealsApi.getDeals(filters);
      return response;
    },
  });

export const getDeal = (id: number) =>
  queryOptions({
    queryKey: ["deal", id],
    queryFn: async () => {
      return await dealsApi.getDeal(id);
    },
  });

export const getDealsByContact = (contactId: number) =>
  queryOptions({
    queryKey: ["deals", "contact", contactId],
    queryFn: async () => {
      const response = await dealsApi.getDealsByContact(contactId);
      return response;
    },
  });

export const getDealsByAccount = (accountId: number) =>
  queryOptions({
    queryKey: ["deals", "account", accountId],
    queryFn: async () => {
      const response = await dealsApi.getDealsByAccount(accountId);
      return response;
    },
  });

export const getTimeline = (entityType: string, entityId: number, limit?: number) =>
  queryOptions({
    queryKey: ["timeline", entityType, entityId, limit],
    queryFn: async () => {
      const response = await activitiesApi.getTimeline(entityType, entityId, limit);
      return response.activities;
    },
  });
