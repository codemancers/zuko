import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ContactsService } from '@zuko/sales';
import { getContextEntities } from '../context/tool-context';

/**
 * LangChain tool for retrieving contact owner(s)
 * Used by AI agents to find who owns a contact.
 * contactId is optional; when omitted, uses the single contact from context.
 */
export function createGetContactOwnerTool(contactsService: ContactsService) {
  return tool(
    async (input, config?: unknown) => {
      const contextEntities = getContextEntities(config);
      const contextContacts =
        contextEntities?.filter((e) => e.type === 'contact') ?? [];
      const contactFromContext =
        contextContacts.length === 1 ? contextContacts[0] : undefined;
      const contactId = input.contactId ?? contactFromContext?.id;

      if (contactId === undefined) {
        return {
          error:
            'No contact in context and no contactId provided. Add a contact via the + button or provide contactId.',
        };
      }

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
      description: `Get the owner(s) of a contact. ID is optional; when omitted, uses the single contact from context. Returns primary owner and all assigned owners.

Use when the user asks who owns or is responsible for a contact. Returns: primaryOwner, allOwners, ownerCount`,
      schema: z.object({
        contactId: z
          .number()
          .describe('Optional. Contact ID; when omitted, tool uses context.')
          .optional(),
      }),
    },
  );
}
