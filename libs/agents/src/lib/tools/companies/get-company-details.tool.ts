import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { CompaniesService } from '@zuko/sales';
import {
  getContextEntities,
  getOrganizationId,
} from '../context/tool-context';

/**
 * LangChain tool for retrieving company information.
 * When contextEntities are available from graph state (second argument),
 * a single company in context is used so the model does not need to guess the ID.
 */
export function createGetCompanyDetailsTool(
  companiesService: CompaniesService,
) {
  return tool(
    async (input, config?: unknown) => {
      const contextEntities = getContextEntities(config);
      const contextCompanies =
        contextEntities?.filter((e) => e.type === 'company') ?? [];

      if (contextCompanies.length > 1) {
        const ids = contextCompanies.map((c) => c.id);
        return {
          useQueryToolInstead: true,
          message: `Multiple companies in context (${
            contextCompanies.length
          }). Use query_companies with filters.companyIds: [${ids.join(
            ', ',
          )}] to fetch all in one call, or get_company_details with companyId for each.`,
          companyIds: ids,
        };
      }

      const companyFromContext =
        contextCompanies.length === 1 ? contextCompanies[0] : undefined;
      const companyId: number | undefined =
        companyFromContext != null ? companyFromContext.id : input.companyId;

      if (companyId === undefined) {
        return {
          error:
            'No company in context and no companyId provided. Add a company via the + button or provide companyId.',
        };
      }

      const organizationId = getOrganizationId(config);
      if (organizationId === undefined) {
        return {
          error:
            'No organization context. Please select an organization and try again.',
        };
      }

      try {
        const company = await companiesService.findById(
          companyId,
          organizationId,
        );

        return {
          id: company.id,
          companyName: company.companyName,
          website: company.website || null,
          linkedinUrl: company.linkedinUrl || null,
          summary: company.summary || null,
          contactCount: (company as any)._count?.contacts || 0,
          createdAt: company.createdAt.toISOString(),
          updatedAt: company.updatedAt.toISOString(),
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return {
            error: `Company with ID ${companyId} not found`,
          };
        }
        throw error;
      }
    },
    {
      name: 'get_company_details',
      description: `Get full details for a company. ID is optional; when omitted, uses the single company from context (contextEntities). Call whenever the user asks for company details.

- One company in context: call with no arguments.
- User provided an ID: you may pass companyId.
- Multiple companies in context: use query_companies with filters.companyIds instead.
Returns: Company object with id, companyName, website, linkedinUrl, summary, contactCount, createdAt, updatedAt`,
      schema: z.object({
        companyId: z
          .number()
          .describe('Optional. Company ID; when omitted, tool uses context.')
          .optional(),
      }),
    },
  );
}
