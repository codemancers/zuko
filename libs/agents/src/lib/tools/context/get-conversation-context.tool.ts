import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ContextEntityReference } from '../../types/chat.types';

type ToolRunConfig = {
  configurable?: { contextEntities?: ContextEntityReference[] };
  state?: { contextEntities?: ContextEntityReference[] };
};

function getContextEntities(
  config: unknown,
): ContextEntityReference[] | undefined {
  const c = config as ToolRunConfig | undefined;
  return c?.state?.contextEntities ?? c?.configurable?.contextEntities;
}

/**
 * LangChain tool that returns the current conversation context:
 * contacts, companies, and deals the user has added to the conversation.
 * Use this when you need to see what entities are in context before calling
 * get_contact_details, get_company_details, or query_* tools (e.g. when there
 * is a mix of types or you are unsure what is in context).
 */
export function createGetConversationContextTool() {
  return tool(
    async (_input, config?: unknown) => {
      const contextEntities = getContextEntities(config) ?? [];

      const contacts = contextEntities
        .filter((e) => e.type === 'contact')
        .map((e) => ({ type: e.type, id: e.id }));
      const companies = contextEntities
        .filter((e) => e.type === 'company')
        .map((e) => ({ type: e.type, id: e.id }));
      const deals = contextEntities
        .filter((e) => e.type === 'deal')
        .map((e) => ({ type: e.type, id: e.id }));

      return {
        contacts,
        companies,
        deals,
        total: contextEntities.length,
        summary:
          contextEntities.length === 0
            ? 'No entities in context. User can add contacts, companies, or deals via the + button.'
            : `${contacts.length} contact(s), ${companies.length} company(ies), ${deals.length} deal(s) in context. Use get_contact_details/get_company_details for single entities, or query_contacts/query_companies for multiple.`,
      };
    },
    {
      name: 'get_conversation_context',
      description: `Returns the current conversation context: list of contacts, companies, and deals the user has added to this conversation. Call this when you need to see what is in context before fetching details—e.g. when there is a mix of contacts and companies, or when you are unsure. Then use get_contact_details, get_company_details, or query_contacts/query_companies as needed. No arguments.`,
      schema: z.object({}),
    },
  );
}
