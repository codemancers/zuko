import { tool } from 'langchain';
import { Backend } from '../shared/backend';
import { z } from 'zod';
import {
  getOrganizationId,
  getContextEntities,
  getUserId,
  getSignJwt,
} from './context.tools';
import type { ToolRunConfig } from './context.tools';

function orgHeader(organisationId: number | undefined): string {
  return organisationId != null ? String(organisationId) : '';
}

export const getCompanyDetailsTool = tool(
  async (input: { companyId?: number }, config: ToolRunConfig) => {
    const organisationId = getOrganizationId(config);
    const signJwt = getSignJwt(config);
    const contextEntities = getContextEntities(config);
    const contextCompanies =
      contextEntities?.filter((e) => e.type === 'company') ?? [];

    if (contextCompanies.length > 1) {
      const ids = contextCompanies.map((c) => c.id);
      return {
        useQueryToolInstead: true,
        message: `Multiple companies in context (${contextCompanies.length}). Use query_companies with filters.companyIds: [${ids.join(', ')}]`,
        companyIds: ids,
      };
    }

    const companyFromContext =
      contextCompanies.length === 1 ? contextCompanies[0] : undefined;
    const companyId = input.companyId ?? companyFromContext?.id;

    if (companyId === undefined) {
      return {
        error:
          'No company in context and no companyId provided. Add a company or provide companyId.',
      };
    }
    if (!organisationId) {
      return { error: 'User context (organisationId) is required' };
    }

    const result = await Backend(`/companies/${companyId}`, {
      method: 'GET',
      organisationId: orgHeader(organisationId),
      signJwt,
    });
    if (!result.success || !result.data) {
      return {
        error: result.error ?? 'Failed to fetch company',
        company: null,
      };
    }
    return {
      success: true,
      message: 'Company fetched successfully',
      company: result.data,
    };
  },
  {
    name: 'get_company_details',
    description:
      'Get full details for a company. ID is optional; when omitted, uses the single company from context. Returns: id, companyName, website, linkedinUrl, summary, contactCount, createdAt, updatedAt.',
    schema: z.object({
      companyId: z
        .number()
        .describe('Optional. Company ID; when omitted, uses context.')
        .optional(),
    }),
  },
);

export const queryCompaniesTool = tool(
  async (
    input: {
      filters?: {
        companyIds?: number[];
        ownerId?: number;
        hasWebsite?: boolean;
        contactCountMin?: number;
        contactCountMax?: number;
        createdAfter?: string;
        createdBefore?: string;
        search?: string;
      };
      aggregation?: 'count' | 'list';
      limit?: number;
    },
    config: ToolRunConfig,
  ) => {
    const organisationId = getOrganizationId(config);
    if (!organisationId) {
      return { error: 'User context (organisationId) is required' };
    }
    const signJwt = getSignJwt(config);
    const { filters = {}, aggregation = 'list', limit = 100 } = input;
    const result = await Backend('/companies/query', {
      method: 'POST',
      organisationId: orgHeader(organisationId),
      body: { filters, aggregation, limit },
      signJwt,
    });
    if (!result.success) {
      return { error: result.error ?? 'Failed to query companies' };
    }
    return result.data;
  },
  {
    name: 'query_companies',
    description:
      'Query companies with filters and aggregations. Use for: multiple companies (filters.companyIds), analytical questions (count, list). Supports filters: companyIds, ownerId, hasWebsite, contactCountMin/Max, createdAfter/Before, search. aggregation: count | list.',
    schema: z.object({
      filters: z
        .object({
          companyIds: z.array(z.number()).optional(),
          ownerId: z.number().optional(),
          hasWebsite: z.boolean().optional(),
          contactCountMin: z.number().optional(),
          contactCountMax: z.number().optional(),
          createdAfter: z.string().optional(),
          createdBefore: z.string().optional(),
          search: z.string().optional(),
        })
        .optional(),
      aggregation: z.enum(['count', 'list']).optional().default('list'),
      limit: z.number().optional().default(100),
    }),
  },
);

export const createCompanyTool = tool(
  async (
    input: {
      companyName: string;
      website: string;
      linkedinUrl?: string;
      summary?: string;
      ownerIds?: number[];
      primaryOwnerId?: number;
    },
    config: ToolRunConfig,
  ) => {
    const organisationId = getOrganizationId(config);
    const signJwt = getSignJwt(config);
    const userId = getUserId(config);
    if (!organisationId) {
      return { error: 'User context (organisationId) is required' };
    }
    const ownerIds = input.ownerIds?.length
      ? input.ownerIds
      : userId != null
        ? [userId]
        : [];
    if (ownerIds.length === 0) {
      return {
        error:
          'No owner available. Provide ownerIds or ensure userId is in context.',
      };
    }
    const result = await Backend('/companies', {
      method: 'POST',
      organisationId: orgHeader(organisationId),
      signJwt,
      body: {
        companyName: input.companyName,
        website: input.website,
        linkedinUrl: input.linkedinUrl,
        summary: input.summary,
        ownerIds,
        primaryOwnerId: input.primaryOwnerId,
      },
    });
    if (!result.success) {
      return {
        error: result.error ?? 'Failed to create company',
        company: null,
      };
    }
    return {
      success: true,
      message: 'Company created.',
      company: result.data,
    };
  },
  {
    name: 'create_company',
    description:
      'Create a new company. companyName and website are required. ownerIds defaults to current user if omitted.',
    schema: z.object({
      companyName: z.string().min(1).describe('Company name (required)'),
      website: z.string().min(1).describe('Company website URL (required)'),
      linkedinUrl: z.string().optional(),
      summary: z.string().optional(),
      ownerIds: z.array(z.number()).optional(),
      primaryOwnerId: z.number().optional(),
    }),
  },
);

export const updateCompanyTool = tool(
  async (
    input: {
      companyId?: number;
      companyName?: string;
      website?: string;
      linkedinUrl?: string;
      summary?: string;
    },
    config: ToolRunConfig,
  ) => {
    const organisationId = getOrganizationId(config);
    const signJwt = getSignJwt(config);
    const contextEntities = getContextEntities(config);
    const contextCompanies =
      contextEntities?.filter((e) => e.type === 'company') ?? [];
    const companyFromContext =
      contextCompanies.length === 1 ? contextCompanies[0] : undefined;
    const companyId = input.companyId ?? companyFromContext?.id;

    if (companyId === undefined) {
      return {
        error:
          'No company in context and no companyId provided. Provide companyId.',
      };
    }
    if (!organisationId) {
      return { error: 'User context (organisationId) is required' };
    }
    const updates: Record<string, string | undefined> = {};
    if (input.companyName !== undefined)
      updates.companyName = input.companyName;
    if (input.website !== undefined) updates.website = input.website;
    if (input.linkedinUrl !== undefined)
      updates.linkedinUrl = input.linkedinUrl;
    if (input.summary !== undefined) updates.summary = input.summary;
    if (Object.keys(updates).length === 0) {
      return {
        error:
          'Provide at least one field to update: companyName, website, linkedinUrl, or summary.',
      };
    }

    const result = await Backend(`/companies/${companyId}`, {
      method: 'PATCH',
      organisationId: orgHeader(organisationId),
      signJwt,
      body: updates,
    });
    if (!result.success) {
      return {
        error: result.error ?? 'Failed to update company',
        company: null,
      };
    }
    return {
      success: true,
      message: 'Company updated.',
      company: result.data,
    };
  },
  {
    name: 'update_company',
    description:
      'Update a company. Pass only fields to change. companyId optional if single company in context.',
    schema: z.object({
      companyId: z.number().optional(),
      companyName: z.string().optional(),
      website: z.string().optional(),
      linkedinUrl: z.string().optional(),
      summary: z.string().optional(),
    }),
  },
);

export const companyTools = [
  getCompanyDetailsTool,
  queryCompaniesTool,
  createCompanyTool,
  updateCompanyTool,
];
