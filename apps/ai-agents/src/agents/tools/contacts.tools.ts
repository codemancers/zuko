import { tool } from "langchain";
import { Backend } from "../../shared/backend";
import { z } from "zod";
import {
  getOrganizationId,
  getContextEntities,
  getUserId,
} from "./context.tools";

function orgHeader(organisationId: number | undefined): string {
  return organisationId != null ? String(organisationId) : "";
}

export const getContactDetailsTool = tool(
  async (input: { contactId?: number }, config) => {
    const organisationId = getOrganizationId(config);
    const contextEntities = getContextEntities(config);
    const contextContacts =
      contextEntities?.filter((e) => e.type === "contact") ?? [];

    if (contextContacts.length > 1) {
      const ids = contextContacts.map((c) => c.id);
      return {
        useQueryToolInstead: true,
        message: `Multiple contacts in context. Use query_contacts with filters.contactIds: [${ids.join(", ")}]`,
        contactIds: ids,
      };
    }

    const contactFromContext =
      contextContacts.length === 1 ? contextContacts[0] : undefined;
    const contactId = input.contactId ?? contactFromContext?.id;

    if (contactId === undefined) {
      return {
        error:
          "No contact in context and no contactId provided. Add a contact or provide contactId.",
      };
    }
    if (!organisationId) {
      return { error: "User context (organisationId) is required" };
    }

    const result = await Backend(`/contacts/${contactId}`, {
      method: "GET",
      organisationId: orgHeader(organisationId),
    });
    if (!result.success || !result.data) {
      return {
        error: result.error ?? "Failed to fetch contact",
        contact: null,
      };
    }
    return {
      success: true,
      message: "Contact fetched successfully",
      contact: result.data,
    };
  },
  {
    name: "get_contact_details",
    description:
      "Get full details for a contact. ID is optional; when omitted, uses the single contact from context. Returns: id, name, email, phone, linkedinId, notes, createdAt, updatedAt.",
    schema: z.object({
      contactId: z.number().optional().describe("Optional. Contact ID."),
    }),
  }
);

export const getContactOwnerTool = tool(
  async (input: { contactId?: number }, config) => {
    const organisationId = getOrganizationId(config);
    const contextEntities = getContextEntities(config);
    const contextContacts =
      contextEntities?.filter((e) => e.type === "contact") ?? [];
    const contactFromContext =
      contextContacts.length === 1 ? contextContacts[0] : undefined;
    const contactId = input.contactId ?? contactFromContext?.id;

    if (contactId === undefined) {
      return {
        error:
          "No contact in context and no contactId provided. Add a contact or provide contactId.",
      };
    }
    if (!organisationId) {
      return { error: "User context (organisationId) is required" };
    }

    const result = await Backend(`/contacts/${contactId}`, {
      method: "GET",
      organisationId: orgHeader(organisationId),
    });
    if (!result.success || !result.data) {
      return {
        error: result.error ?? "Failed to fetch contact",
      };
    }
    const contact = result.data as {
      id: number;
      owners?: Array<{
        isPrimary: boolean;
        assignedAt: string;
        user: { id: number; name: string; email: string };
      }>;
    };
    if (!contact.owners?.length) {
      return {
        contactId,
        primaryOwner: null,
        allOwners: [],
        message: "This contact has no owners assigned",
      };
    }
    const primaryOwner = contact.owners.find((o) => o.isPrimary);
    const allOwners = contact.owners.map((o) => ({
      id: o.user.id,
      name: o.user.name,
      email: o.user.email,
      isPrimary: o.isPrimary,
      assignedAt: o.assignedAt,
    }));
    return {
      contactId,
      primaryOwner: primaryOwner
        ? {
            id: primaryOwner.user.id,
            name: primaryOwner.user.name,
            email: primaryOwner.user.email,
            assignedAt: primaryOwner.assignedAt,
          }
        : allOwners[0],
      allOwners,
      ownerCount: allOwners.length,
    };
  },
  {
    name: "get_contact_owner",
    description:
      "Get the owner(s) of a contact. ID optional; when omitted, uses single contact from context. Returns primaryOwner, allOwners, ownerCount.",
    schema: z.object({
      contactId: z.number().optional(),
    }),
  }
);

export const queryContactsTool = tool(
  async (
    input: {
      filters?: {
        contactIds?: number[];
        ownerId?: number;
        search?: string;
        hasEmail?: boolean;
        createdAfter?: string;
        createdBefore?: string;
      };
      aggregation?: "count" | "list";
      groupBy?: "ownerId";
      limit?: number;
    },
    config
  ) => {
    const organisationId = getOrganizationId(config);
    if (!organisationId) {
      return { error: "User context (organisationId) is required" };
    }
    const {
      filters = {},
      aggregation = "list",
      groupBy,
      limit = 100,
    } = input;
    const result = await Backend("/contacts/query", {
      method: "POST",
      organisationId: orgHeader(organisationId),
      body: { filters, aggregation, groupBy, limit },
    });
    if (!result.success) {
      return { error: result.error ?? "Failed to query contacts" };
    }
    return result.data;
  },
  {
    name: "query_contacts",
    description:
      "Query contacts with filters and aggregations. Use for multiple contacts (filters.contactIds), analytical questions. Supports: contactIds, ownerId, search, hasEmail, createdAfter/Before. aggregation: count | list. groupBy: ownerId.",
    schema: z.object({
      filters: z
        .object({
          contactIds: z.array(z.number()).optional(),
          ownerId: z.number().optional(),
          search: z.string().optional(),
          hasEmail: z.boolean().optional(),
          createdAfter: z.string().optional(),
          createdBefore: z.string().optional(),
        })
        .optional(),
      aggregation: z.enum(["count", "list"]).optional().default("list"),
      groupBy: z.enum(["ownerId"]).optional(),
      limit: z.number().optional().default(100),
    }),
  }
);

export const createContactTool = tool(
  async (
    input: {
      name: string;
      email: string;
      phone?: string;
      linkedinId?: string;
      notes?: string;
      ownerIds?: number[];
      primaryOwnerId?: number;
    },
    config
  ) => {
    const organisationId = getOrganizationId(config);
    const userId = getUserId(config);
    if (!organisationId) {
      return { error: "User context (organisationId) is required" };
    }
    const ownerIds =
      input.ownerIds?.length ? input.ownerIds : userId != null ? [userId] : [];
    if (ownerIds.length === 0) {
      return {
        error:
          "No owner available. Provide ownerIds or ensure userId is in context.",
      };
    }
    const result = await Backend("/contacts", {
      method: "POST",
      organisationId: orgHeader(organisationId),
      body: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        linkedinId: input.linkedinId,
        notes: input.notes,
        ownerIds,
        primaryOwnerId: input.primaryOwnerId,
      },
    });
    if (!result.success) {
      return { error: result.error ?? "Failed to create contact", contact: null };
    }
    return {
      success: true,
      message: "Contact created.",
      contact: result.data,
    };
  },
  {
    name: "create_contact",
    description:
      "Create a new contact. name and email are required. ownerIds defaults to current user if omitted.",
    schema: z.object({
      name: z.string().min(1).describe("Contact full name (required)"),
      email: z.string().min(1).describe("Email (required)"),
      phone: z.string().optional(),
      linkedinId: z.string().optional(),
      notes: z.string().optional(),
      ownerIds: z.array(z.number()).optional(),
      primaryOwnerId: z.number().optional(),
    }),
  }
);

export const updateContactTool = tool(
  async (
    input: {
      contactId?: number;
      name?: string;
      email?: string;
      phone?: string;
      linkedinId?: string;
      notes?: string;
    },
    config
  ) => {
    const organisationId = getOrganizationId(config);
    const contextEntities = getContextEntities(config);
    const contextContacts =
      contextEntities?.filter((e) => e.type === "contact") ?? [];
    const contactFromContext =
      contextContacts.length === 1 ? contextContacts[0] : undefined;
    const contactId = input.contactId ?? contactFromContext?.id;

    if (contactId === undefined) {
      return {
        error:
          "No contact in context and no contactId provided. Provide contactId.",
      };
    }
    if (!organisationId) {
      return { error: "User context (organisationId) is required" };
    }
    const updates: Record<string, string | undefined> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.email !== undefined) updates.email = input.email;
    if (input.phone !== undefined) updates.phone = input.phone;
    if (input.linkedinId !== undefined) updates.linkedinId = input.linkedinId;
    if (input.notes !== undefined) updates.notes = input.notes;
    if (Object.keys(updates).length === 0) {
      return {
        error:
          "Provide at least one field to update: name, email, phone, linkedinId, or notes.",
      };
    }

    const result = await Backend(`/contacts/${contactId}`, {
      method: "PATCH",
      organisationId: orgHeader(organisationId),
      body: updates,
    });
    if (!result.success) {
      return { error: result.error ?? "Failed to update contact", contact: null };
    }
    return {
      success: true,
      message: "Contact updated.",
      contact: result.data,
    };
  },
  {
    name: "update_contact",
    description:
      "Update a contact. Pass only fields to change. contactId optional if single contact in context.",
    schema: z.object({
      contactId: z.number().optional(),
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      linkedinId: z.string().optional(),
      notes: z.string().optional(),
    }),
  }
);

export const contactTools = [
  getContactDetailsTool,
  getContactOwnerTool,
  queryContactsTool,
  createContactTool,
  updateContactTool,
];
