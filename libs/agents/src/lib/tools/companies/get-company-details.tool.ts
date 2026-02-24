import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { CompaniesService } from '@zuko/sales';

/**
 * LangChain tool for retrieving company information
 * Used by AI agents to fetch company details
 */
export function createGetCompanyDetailsTool(
  companiesService: CompaniesService
) {
  return tool(
    async ({ companyId }) => {
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
      description: `Get full details about a company by ID. Use this when you need information about a company from the context.

Returns: Company object with id, companyName, website, linkedinUrl, summary, contactCount, createdAt, updatedAt`,
      schema: z.object({
        companyId: z.number().describe('The company ID to retrieve'),
      }),
    }
  );
}
