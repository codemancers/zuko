import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { CompaniesService } from '@zuko/sales';
import {
  getContextEntities,
  getOrganizationId,
} from '../context/tool-context';

/**
 * LangChain tool for updating a company.
 * When contextEntities are available, a single company in context is used when companyId is omitted.
 * Pass only the fields to update; the backend applies them and returns the updated company for confirmation.
 */
export function createUpdateCompanyTool(companiesService: CompaniesService) {
  return tool(
    async (input = {}, config?: unknown) => {
      const contextEntities = getContextEntities(config);
      const contextCompanies =
        contextEntities?.filter((e) => e.type === 'company') ?? [];

      if (contextCompanies.length > 1) {
        return {
          error: `Multiple companies in context (${contextCompanies.length}). Pass companyId to specify which company to update.`,
        };
      }

      const companyFromContext =
        contextCompanies.length === 1 ? contextCompanies[0] : undefined;
      const companyId =
        (input as { companyId?: number }).companyId ??
        companyFromContext?.id;

      if (companyId === undefined) {
        return {
          error:
            'No company in context and no companyId provided. Add a company via the + button or provide companyId.',
        };
      }

      const payload = input as {
        companyName?: string;
        website?: string;
        linkedinUrl?: string;
        summary?: string;
      };
      const updates: Record<string, string | undefined> = {};
      if (payload.companyName !== undefined)
        updates.companyName = payload.companyName;
      if (payload.website !== undefined) updates.website = payload.website;
      if (payload.linkedinUrl !== undefined)
        updates.linkedinUrl = payload.linkedinUrl;
      if (payload.summary !== undefined) updates.summary = payload.summary;

      if (Object.keys(updates).length === 0) {
        return {
          error:
            'Provide at least one field to update: companyName, website, linkedinUrl, or summary.',
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
        const company = await companiesService.update(
          companyId,
          organizationId,
          updates,
        );
        const c = company as {
          id: number;
          companyName: string;
          website?: string | null;
          linkedinUrl?: string | null;
          summary?: string | null;
          updatedAt: Date;
        };
        return {
          success: true,
          message: 'Company updated.',
          company: {
            id: c.id,
            companyName: c.companyName,
            website: c.website ?? null,
            linkedinUrl: c.linkedinUrl ?? null,
            summary: c.summary ?? null,
            updatedAt: c.updatedAt.toISOString(),
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return { error: `Company with ID ${companyId} not found` };
          }
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      name: 'update_company',
      description: `Update a company's details. Use when the user says something like "change the company name to X", "update their website to Y", "set the summary to Z". ID is optional: when omitted, uses the single company from context (contextEntities). Pass only the fields you want to change. Returns the updated company for confirmation.`,
      schema: z.object({
        companyId: z
          .number()
          .describe(
            'Optional. Company ID; when omitted, uses the single company from context.',
          )
          .optional(),
        companyName: z.string().describe('Company name').optional(),
        website: z.string().describe('Company website URL').optional(),
        linkedinUrl: z.string().describe('LinkedIn company page URL').optional(),
        summary: z.string().describe('Company summary or description').optional(),
      }),
    },
  );
}
