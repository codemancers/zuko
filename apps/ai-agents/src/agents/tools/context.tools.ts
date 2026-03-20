import { tool } from 'langchain';
import { z } from 'zod';
import type { ContextEntityReference } from '../../types/chat.types';

/**
 * Runtime config that may be passed when a tool is invoked from a graph.
 * LangGraph can inject state/config so tools can read contextEntities and organizationId.
 */
export type ToolRunConfig = {
  configurable?: {
    contextEntities?: ContextEntityReference[];
    organizationId?: number;
    userId?: number;
  };
  state?: {
    contextEntities?: ContextEntityReference[];
    organizationId?: number;
    userId?: number;
  };
};

/**
 * Get context entities from LangGraph tool invocation config.
 * Used by context-aware tools to resolve contact/company/deal from conversation context.
 */
export function getContextEntities(
  config?: ToolRunConfig,
): ContextEntityReference[] | undefined {
  return (
    config?.state?.contextEntities ?? config?.configurable?.contextEntities
  );
}

/**
 * Get active organization ID from LangGraph tool invocation config.
 * Set by the chat controller from the user's session (active organization).
 * Required for all sales entity operations (contacts, companies, deals).
 */
export function getOrganizationId(
  config?: ToolRunConfig,
): number | undefined {
  return config?.state?.organizationId ?? config?.configurable?.organizationId;
}

/**
 * Get authenticated user ID from LangGraph tool invocation config/state.
 * Set by the chat controller in the LangGraph input state.
 * Useful for default ownership assignment when creating entities from chat.
 */
export function getUserId(
  config?: ToolRunConfig,
): number | undefined {
  return config?.state?.userId ?? config?.configurable?.userId;
}




/**
 * LangChain tool that returns the current conversation context:
 * contacts, companies, and deals the user has added to the conversation.
 * Use this when you need to see what entities are in context before calling
 * get_contact_details, get_company_details, or query_* tools (e.g. when there
 * is a mix of types or you are unsure what is in context).
 */

function isContact(
  entity: ContextEntityReference,
): entity is ContextEntityReference & { type: 'contact' } {
  return entity.type === 'contact';
}

function isCompany(
  entity: ContextEntityReference,
): entity is ContextEntityReference & { type: 'company' } {
  return entity.type === 'company';
}

function isDeal(
  entity: ContextEntityReference,
): entity is ContextEntityReference & { type: 'deal' } {
  return entity.type === 'deal';
}

export const getConversationContextTool = tool(
  async (
    _input: Record<string, never>,
    config?: ToolRunConfig,
  ): Promise<{
    contacts: { type: 'contact'; id: number }[];
    companies: { type: 'company'; id: number }[];
    deals: { type: 'deal'; id: number }[];
    total: number;
    summary: string;
  }> => {
    const contextEntities = getContextEntities(config) ?? [];

    const contacts = contextEntities.filter(isContact).map((e) => ({
      type: 'contact' as const,
      id: e.id,
    }));

    const companies = contextEntities.filter(isCompany).map((e) => ({
      type: 'company' as const,
      id: e.id,
    }));

    const deals = contextEntities.filter(isDeal).map((e) => ({
      type: 'deal' as const,
      id: e.id,
    }));

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


export const contextTools = [getConversationContextTool];
