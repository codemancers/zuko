import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ContactsService } from '@zuko/sales';
import {
  getContextEntities,
  getOrganizationId,
} from '../context/tool-context';

/**
 * LangChain tool for updating a contact.
 * When contextEntities are available, a single contact in context is used when contactId is omitted.
 * Pass only the fields to update; the backend applies them and returns the updated contact for confirmation.
 */
export function createUpdateContactTool(contactsService: ContactsService) {
  return tool(
    async (input = {}, config?: unknown) => {
      const contextEntities = getContextEntities(config);
      const contextContacts =
        contextEntities?.filter((e) => e.type === 'contact') ?? [];

      if (contextContacts.length > 1) {
        return {
          error: `Multiple contacts in context (${contextContacts.length}). Pass contactId to specify which contact to update.`,
        };
      }

      const contactFromContext =
        contextContacts.length === 1 ? contextContacts[0] : undefined;
      const contactId =
        (input as { contactId?: number }).contactId ?? contactFromContext?.id;

      if (contactId === undefined) {
        return {
          error:
            'No contact in context and no contactId provided. Add a contact via the + button or provide contactId.',
        };
      }

      const payload = input as {
        name?: string;
        email?: string;
        phone?: string;
        linkedinId?: string;
        notes?: string;
      };
      const updates: Record<string, string | undefined> = {};
      if (payload.name !== undefined) updates.name = payload.name;
      if (payload.email !== undefined) updates.email = payload.email;
      if (payload.phone !== undefined) updates.phone = payload.phone;
      if (payload.linkedinId !== undefined) updates.linkedinId = payload.linkedinId;
      if (payload.notes !== undefined) updates.notes = payload.notes;

      if (Object.keys(updates).length === 0) {
        return {
          error:
            'Provide at least one field to update: name, email, phone, linkedinId, or notes.',
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
        const contact = await contactsService.update(
          contactId,
          organizationId,
          updates as any,
        );
        return {
          success: true,
          message: 'Contact updated.',
          contact: {
            id: contact.id,
            name: contact.name,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            linkedinId: contact.linkedinId ?? null,
            notes: contact.notes ?? null,
            updatedAt: (contact as { updatedAt: Date }).updatedAt.toISOString(),
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return { error: `Contact with ID ${contactId} not found` };
          }
          return { error: error.message };
        }
        throw error;
      }
    },
    {
      name: 'update_contact',
      description: `Update a contact's details. Use when the user says something like "change this contact's email to X", "update their phone to Y", "set their name to Z". ID is optional: when omitted, uses the single contact from context (contextEntities). Pass only the fields you want to change. Returns the updated contact for confirmation.`,
      schema: z.object({
        contactId: z
          .number()
          .describe('Optional. Contact ID; when omitted, uses the single contact from context.')
          .optional(),
        name: z.string().describe('Contact full name').optional(),
        email: z.string().describe('Email address').optional(),
        phone: z.string().describe('Phone number').optional(),
        linkedinId: z.string().describe('LinkedIn profile ID or URL').optional(),
        notes: z.string().describe('Notes about the contact').optional(),
      }),
    },
  );
}
