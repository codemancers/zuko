import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ContactsService } from '@zuko/sales';

/**
 * LangChain tool for retrieving contact owner(s)
 * Used by AI agents to find who owns a contact
 */
export function createGetContactOwnerTool(contactsService: ContactsService) {
  return tool(
    async ({ contactId }) => {
      try {
        const contact = await contactsService.findById(contactId);

        if (!contact.owners || contact.owners.length === 0) {
          return {
            contactId,
            primaryOwner: null,
            allOwners: [],
            message: 'This contact has no owners assigned',
          };
        }

        const primaryOwner = contact.owners.find((o) => o.isPrimary);
        const allOwners = contact.owners.map((o) => ({
          id: o.user.id,
          name: o.user.name,
          email: o.user.email,
          isPrimary: o.isPrimary,
          assignedAt: o.assignedAt.toISOString(),
        }));

        return {
          contactId,
          primaryOwner: primaryOwner
            ? {
                id: primaryOwner.user.id,
                name: primaryOwner.user.name,
                email: primaryOwner.user.email,
                assignedAt: primaryOwner.assignedAt.toISOString(),
              }
            : allOwners[0], // Fallback to first owner if no primary
          allOwners,
          ownerCount: allOwners.length,
        };
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          return {
            error: `Contact with ID ${contactId} not found`,
          };
        }
        throw error;
      }
    },
    {
      name: 'get_contact_owner',
      description: `Get the owner(s) of a contact. Returns primary owner and all assigned owners with their details.

Use this when asked questions like:
- "Who owns this contact?"
- "Who is responsible for this contact?"
- "Who is the contact owner?"

Returns: primaryOwner (user object), allOwners (array of users), ownerCount`,
      schema: z.object({
        contactId: z.number().describe('The contact ID to get owners for'),
      }),
    },
  );
}
