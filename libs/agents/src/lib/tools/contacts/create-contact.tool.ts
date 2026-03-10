import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { ContactsService } from '@zuko/sales';
import { getOrganizationId, getUserId } from '../context/tool-context';

/**
 * LangChain tool for creating a contact from chat.
 *
 * Chat-specific requirements (per product spec):
 * - name and email are mandatory
 * - owner defaults to the authenticated user (state.userId) unless explicitly provided
 */
export function createCreateContactTool(contactsService: ContactsService) {
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
        name: string;
        email: string;
        phone?: string;
        linkedinId?: string;
        notes?: string;
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
        const contact = await contactsService.create({
          organizationId,
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          linkedinId: payload.linkedinId,
          notes: payload.notes,
          ownerIds,
          primaryOwnerId: payload.primaryOwnerId,
        });

        return {
          success: true,
          message: 'Contact created.',
          contact: {
            id: contact.id,
            name: contact.name,
            email: contact.email ?? null,
            phone: contact.phone ?? null,
            linkedinId: contact.linkedinId ?? null,
            notes: contact.notes ?? null,
            owners: (contact.owners ?? []).map((o: any) => ({
              id: o.user.id,
              name: o.user.name,
              email: o.user.email,
              isPrimary: o.isPrimary,
              assignedAt: o.assignedAt.toISOString(),
            })),
            createdAt: (contact as { createdAt: Date }).createdAt.toISOString(),
            updatedAt: (contact as { updatedAt: Date }).updatedAt.toISOString(),
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
      name: 'create_contact',
      description: `Create a new contact from chat. Use when the user says "create a contact" or "add this person as a contact".

Chat requirements:
- name is required
- email is required
- ownerIds defaults to the authenticated user (state.userId) if omitted

Returns: { success, message, contact } on success; { error } on failure.`,
      schema: z.object({
        name: z.string().min(1).describe('Contact full name (required)'),
        email: z
          .string()
          .min(1)
          .describe('Email address (required; must be unique per org)'),
        phone: z.string().optional().describe('Phone number (E.164 format)'),
        linkedinId: z
          .string()
          .optional()
          .describe('LinkedIn profile ID or URL'),
        notes: z.string().optional().describe('Notes about the contact'),
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

