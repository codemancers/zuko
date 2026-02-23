import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { AccountsService } from '@zuko/sales';

/**
 * LangChain tool for retrieving account information
 * Used by AI agents to fetch account/company details
 */
export function createGetAccountDetailsTool(accountsService: AccountsService) {
  return tool(
    async ({ accountId }) => {
      try {
        const account = await accountsService.findById(accountId);

        return {
          id: account.id,
          companyName: account.companyName,
          website: account.website || null,
          linkedinUrl: account.linkedinUrl || null,
          summary: account.summary || null,
          contactCount: (account as any)._count?.contacts || 0,
          createdAt: account.createdAt.toISOString(),
          updatedAt: account.updatedAt.toISOString(),
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return {
            error: `Account with ID ${accountId} not found`,
          };
        }
        throw error;
      }
    },
    {
      name: 'get_account_details',
      description: `Get full details about an account/company by ID. Use this when you need information about an account from the context.

Returns: Account object with id, companyName, website, linkedinUrl, summary, contactCount, createdAt, updatedAt`,
      schema: z.object({
        accountId: z.number().describe('The account ID to retrieve'),
      }),
    }
  );
}
