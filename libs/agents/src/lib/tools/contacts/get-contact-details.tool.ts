import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ContactsService } from '@zuko/sales';
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
 * LangChain tool for retrieving full contact information.
 * When contextEntities are available from graph state (second argument),
 * a single contact in context is used so the model does not need to guess the ID.
 */
export function createGetContactDetailsTool(contactsService: ContactsService) {
  return tool(
    async (input, config?: unknown) => {
      const contextEntities = getContextEntities(config);
      const contextContacts = contextEntities?.filter((e) => e.type === 'contact') ?? [];

      if (contextContacts.length > 1) {
        const ids = contextContacts.map((c) => c.id);
        return {
          useQueryToolInstead: true,
          message: `Multiple contacts in context (${contextContacts.length}). Use query_contacts with filters: { contactIds: [${ids.join(', ')}] } to fetch all of them in one call.`,
          contactIds: ids,
        };
      }

      const contactFromContext = contextContacts.length === 1 ? contextContacts[0] : undefined;
      const contactId = contactFromContext != null ? contactFromContext.id : input.contactId;

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
      description: `Get full details for a single contact by ID. Use when context has exactly one contact.

For multiple contacts in context, use query_contacts with filters.contactIds (list of IDs) instead.

Returns: Contact object with id, name, email, phone, linkedinId, notes, createdAt, updatedAt`,
      schema: z.object({
        contactId: z.number().describe('The contact ID to retrieve'),
      }),
    }
  );
}
