import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { CompaniesService } from '@zuko/sales';
import type { ContextEntityReference } from '../../types/chat.types';

/**
 * Runtime config that may be passed when the tool is invoked from a graph.
 * LangGraph can inject state/config so tools can read contextEntities.
 */
type ToolRunConfig = {
  configurable?: { contextEntities?: ContextEntityReference[] };
  state?: { contextEntities?: ContextEntityReference[] };
};

function getContextEntities(
  config: unknown
): ContextEntityReference[] | undefined {
  const c = config as ToolRunConfig | undefined;
  return c?.state?.contextEntities ?? c?.configurable?.contextEntities;
}

/**
 * LangChain tool for retrieving company information.
 * When contextEntities are available from graph state (second argument),
 * a single company in context is used so the model does not need to guess the ID.
 */
export function createGetCompanyDetailsTool(
  companiesService: CompaniesService
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
            ', '
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

      try {
        const company = await companiesService.findById(companyId);

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
      description: `Get full details for a company. CALL THIS when the user asks for company details and context has companies (do not ask the user for an ID).
- One company in context: call without companyId (ID is taken from context).
- Multiple companies in context: use query_companies with filters.companyIds instead.
Returns: Company object with id, companyName, website, linkedinUrl, summary, contactCount, createdAt, updatedAt`,
      schema: z.object({
        companyId: z.number().describe('The company ID to retrieve').optional(),
      }),
    }
  );
}
