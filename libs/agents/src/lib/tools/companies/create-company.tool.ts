import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { CompaniesService } from '@zuko/sales';
import { getOrganizationId, getUserId } from '../context/tool-context';

/**
 * LangChain tool for creating a company from chat.
 *
 * Chat-specific requirements (per product spec):
 * - companyName and website are mandatory
 * - owner defaults to the authenticated user (state.userId) unless explicitly provided
 */
export function createCreateCompanyTool(companiesService: CompaniesService) {
  return tool(
    async (input, config?: unknown) => {
      const organizationId = getOrganizationId(config);
      if (organizationId === undefined) {
        return {
          error:
            'No organization context. Please select an organization and try again.',
        };
      }

      const userId = getUserId(config);

      const payload = input as {
        companyName: string;
        website: string;
        linkedinUrl?: string;
        summary?: string;
        ownerIds?: number[];
        primaryOwnerId?: number;
      };

      const ownerIds =
        payload.ownerIds && payload.ownerIds.length > 0
          ? payload.ownerIds
          : userId !== undefined
            ? [userId]
            : [];

      if (ownerIds.length === 0) {
        return {
          error:
            'No owner available. Provide ownerIds or ensure userId is present in context.',
        };
      }

      try {
        const company = await companiesService.create({
          organizationId,
          companyName: payload.companyName,
          website: payload.website,
          linkedinUrl: payload.linkedinUrl,
          summary: payload.summary,
          ownerIds,
          primaryOwnerId: payload.primaryOwnerId,
        });

        const c = company as {
          id: number;
          companyName: string;
          website?: string | null;
          linkedinUrl?: string | null;
          summary?: string | null;
          createdAt: Date;
          updatedAt: Date;
          owners?: Array<{
            isPrimary: boolean;
            assignedAt: Date;
            user: { id: number; name: string; email: string };
          }>;
        };

        return {
          success: true,
          message: 'Company created.',
          company: {
            id: c.id,
            companyName: c.companyName,
            website: c.website ?? null,
            linkedinUrl: c.linkedinUrl ?? null,
            summary: c.summary ?? null,
            owners: (c.owners ?? []).map((o) => ({
              id: o.user.id,
              name: o.user.name,
              email: o.user.email,
              isPrimary: o.isPrimary,
              assignedAt: o.assignedAt.toISOString(),
            })),
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      name: 'create_company',
      description: `Create a new company from chat. Use when the user says "create a company" or "add this company".

Chat requirements:
- companyName is required
- website is required (valid URL, e.g. https://example.com)
- ownerIds defaults to the authenticated user (state.userId) if omitted

Returns: { success, message, company } on success; { error } on failure.`,
      schema: z.object({
        companyName: z
          .string()
          .min(1)
          .describe('Company name (required)'),
        website: z
          .string()
          .min(1)
          .describe(
            'Company website URL (required; must be valid http/https URL)',
          ),
        linkedinUrl: z
          .string()
          .optional()
          .describe(
            'LinkedIn company page URL (e.g. https://www.linkedin.com/company/example)',
          ),
        summary: z.string().optional().describe('Company summary or description'),
        ownerIds: z
          .array(z.number())
          .optional()
          .describe(
            'Optional. Owner user IDs. When omitted, defaults to current user.',
          ),
        primaryOwnerId: z
          .number()
          .optional()
          .describe('Optional. Primary owner user ID (must be in ownerIds).'),
      }),
    },
  );
}
