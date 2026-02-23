import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ContactsService } from '@zuko/sales';

/**
 * LangChain tool for retrieving full contact information
 * Used by AI agents to fetch contact details when context is provided
 */
export function createGetContactDetailsTool(contactsService: ContactsService) {
  return tool(
    async ({ contactId }) => {
      try {
        const contact = await contactsService.findById(contactId);

        return {
          id: contact.id,
          name: contact.name,
          email: contact.email || null,
          phone: contact.phone || null,
          linkedinId: contact.linkedinId || null,
          notes: contact.notes || null,
          createdAt: contact.createdAt.toISOString(),
          updatedAt: contact.updatedAt.toISOString(),
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
      name: 'get_contact_details',
      description: `Get full details about a contact by ID. Use this when you need information about a contact from the context.

Returns: Contact object with id, name, email, phone, linkedinId, notes, createdAt, updatedAt`,
      schema: z.object({
        contactId: z.number().describe('The contact ID to retrieve'),
      }),
    }
  );
}
