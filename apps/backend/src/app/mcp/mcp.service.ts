import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import {
  DealsRepository,
  ContactsRepository,
  CompaniesRepository,
  CompaniesService,
  DealsService,
  TaskRepository,
  TaskStatus,
} from '@zuko/sales';
import { PrismaService } from '../../prisma/prisma.service';

// Derive Zod enum from the Prisma TaskStatus enum so they stay in sync
const TASK_STATUS_VALUES = Object.values(TaskStatus) as [string, ...string[]];

/** Wrap a value as an MCP text content response. */
function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly dealsRepository: DealsRepository,
    private readonly contactsRepository: ContactsRepository,
    private readonly companiesRepository: CompaniesRepository,
    private readonly companiesService: CompaniesService,
    private readonly dealsService: DealsService,
    private readonly taskRepository: TaskRepository,
    private readonly prisma: PrismaService,
  ) {}

  async resolveOrganizationId(userId: number): Promise<number> {
    const member = await this.prisma.member.findFirst({
      where: { userId },
      select: { organizationId: true },
    });
    if (!member) {
      throw new NotFoundException(`No organization found for user ${userId}`);
    }
    return member.organizationId;
  }

  /**
   * Handle a single MCP request.
   *
   * A new McpServer + transport is created per request because this endpoint is
   * stateless (`sessionIdGenerator: undefined`). Each request is self-contained —
   * no session affinity is required. The tool registration overhead is minimal
   * compared to the database queries each tool performs.
   */
  async handleRequest(
    req: Request,
    organizationId: number,
    userId: number,
  ): Promise<Response> {
    this.logger.debug(
      `Handling MCP request orgId=${organizationId} userId=${userId}`,
    );
    const server = this.buildServer(organizationId, userId);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    return transport.handleRequest(req);
  }

  // ---------------------------------------------------------------------------
  // Server assembly
  // ---------------------------------------------------------------------------

  private buildServer(organizationId: number, userId: number): McpServer {
    const server = new McpServer({ name: 'zuko-crm', version: '1.0.0' });
    this.registerDealTools(server, organizationId, userId);
    this.registerContactTools(server, organizationId, userId);
    this.registerCompanyTools(server, organizationId, userId);
    this.registerTaskTools(server, organizationId, userId);
    return server;
  }

  // ---------------------------------------------------------------------------
  // Deals
  // ---------------------------------------------------------------------------

  private registerDealTools(
    server: McpServer,
    organizationId: number,
    userId: number,
  ): void {
    server.tool(
      'list_deals',
      'List deals in the CRM, optionally filtered by search term or stage',
      {
        search: z.string().optional().describe('Search term for deal title'),
        stages: z
          .array(z.string())
          .optional()
          .describe(
            'Filter by pipeline stages (e.g. ["qualified", "proposal"])',
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .default(50)
          .describe('Max results'),
      },
      async ({ search, stages, limit }) => {
        const result = await this.dealsRepository.findAll(
          { organizationId, search, stages, isHidden: false },
          { page: 1, limit: limit ?? 50 },
        );
        return textResult(result);
      },
    );

    server.tool(
      'get_deal',
      'Get a single deal by its numeric ID, including associated contacts and companies',
      { id: z.number().int().describe('The deal ID') },
      async ({ id }) => {
        const deal = await this.dealsRepository.findById(id, organizationId);
        return textResult(deal);
      },
    );

    server.tool(
      'create_deal',
      'Create a new deal in the CRM',
      {
        title: z.string().describe('Deal title'),
        value: z.number().optional().describe('Monetary value'),
        currency: z
          .string()
          .optional()
          .default('USD')
          .describe('Currency code (e.g. USD, EUR)'),
        stage: z
          .string()
          .optional()
          .describe('Pipeline stage (e.g. qualified, proposal, won)'),
        probability: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe('Win probability 0–100'),
        expectedCloseDate: z
          .string()
          .optional()
          .describe('Expected close date (ISO 8601)'),
        source: z
          .string()
          .optional()
          .describe('Deal source (e.g. inbound, referral)'),
      },
      async ({
        title,
        value,
        currency,
        stage,
        probability,
        expectedCloseDate,
        source,
      }) => {
        const deal = await this.dealsRepository.create({
          organizationId,
          title,
          value,
          currency,
          stage,
          probability,
          expectedCloseDate: expectedCloseDate
            ? new Date(expectedCloseDate)
            : undefined,
          source,
          ownerIds: [userId],
          primaryOwnerId: userId,
        });
        return textResult(deal);
      },
    );

    server.tool(
      'update_deal',
      'Update an existing deal by its numeric ID',
      {
        id: z.number().int().describe('The deal ID'),
        title: z.string().optional().describe('New title'),
        value: z.number().optional().describe('New monetary value'),
        currency: z.string().optional().describe('Currency code'),
        stage: z.string().optional().describe('New pipeline stage'),
        probability: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe('Win probability 0–100'),
        expectedCloseDate: z
          .string()
          .optional()
          .describe('Expected close date (ISO 8601)'),
        actualCloseDate: z
          .string()
          .optional()
          .describe('Actual close date (ISO 8601)'),
        lostReason: z.string().optional().describe('Reason the deal was lost'),
        source: z.string().optional().describe('Deal source'),
        priority: z.number().int().optional().describe('Deal priority'),
        fields: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Custom field values'),
      },
      async ({
        id,
        title,
        value,
        currency,
        stage,
        probability,
        expectedCloseDate,
        actualCloseDate,
        lostReason,
        source,
        priority,
        fields,
      }) => {
        const existing = await this.dealsRepository.findById(
          id,
          organizationId,
        );
        if (!existing)
          throw new NotFoundException(
            `Deal ${id} not found in this organization`,
          );
        const deal = await this.dealsRepository.update(id, {
          title,
          value,
          currency,
          stage,
          probability,
          expectedCloseDate: expectedCloseDate
            ? new Date(expectedCloseDate)
            : undefined,
          actualCloseDate: actualCloseDate
            ? new Date(actualCloseDate)
            : undefined,
          lostReason,
          source,
          priority,
          fields,
        });
        return textResult(deal);
      },
    );

    server.tool(
      'associate_companies_with_deal',
      'Associate one or more companies with a deal using the CRM relation table',
      {
        dealId: z.number().int().describe('The deal ID'),
        companyIds: z
          .array(z.number().int())
          .min(1)
          .describe('Company IDs to associate with the deal'),
        primaryCompanyId: z
          .number()
          .int()
          .optional()
          .describe('Optional company ID to mark as primary'),
      },
      async ({ dealId, companyIds, primaryCompanyId }) => {
        const uniqueCompanyIds = [...new Set(companyIds)];
        const results = [];

        for (const companyId of uniqueCompanyIds) {
          const association = await this.dealsService.addCompany(
            dealId,
            organizationId,
            {
              companyId,
              isPrimary: primaryCompanyId === companyId,
            },
            userId,
          );
          results.push(association);
        }

        return textResult({
          success: true,
          dealId,
          associatedCompanyIds: uniqueCompanyIds,
          associations: results,
        });
      },
    );

    server.tool(
      'unassociate_companies_from_deal',
      'Remove one or more company associations from a deal',
      {
        dealId: z.number().int().describe('The deal ID'),
        companyIds: z
          .array(z.number().int())
          .min(1)
          .describe('Company IDs to remove from the deal'),
      },
      async ({ dealId, companyIds }) => {
        const uniqueCompanyIds = [...new Set(companyIds)];

        for (const companyId of uniqueCompanyIds) {
          await this.dealsService.removeCompany(
            dealId,
            organizationId,
            companyId,
            userId,
          );
        }

        return textResult({
          success: true,
          dealId,
          unassociatedCompanyIds: uniqueCompanyIds,
        });
      },
    );

    server.tool(
      'associate_companyies_with_deal',
      'Alias for associate_companies_with_deal',
      {
        dealId: z.number().int().describe('The deal ID'),
        companyIds: z
          .array(z.number().int())
          .min(1)
          .describe('Company IDs to associate with the deal'),
        primaryCompanyId: z
          .number()
          .int()
          .optional()
          .describe('Optional company ID to mark as primary'),
      },
      async ({ dealId, companyIds, primaryCompanyId }) => {
        const uniqueCompanyIds = [...new Set(companyIds)];
        const results = [];

        for (const companyId of uniqueCompanyIds) {
          const association = await this.dealsService.addCompany(
            dealId,
            organizationId,
            {
              companyId,
              isPrimary: primaryCompanyId === companyId,
            },
            userId,
          );
          results.push(association);
        }

        return textResult({
          success: true,
          dealId,
          associatedCompanyIds: uniqueCompanyIds,
          associations: results,
        });
      },
    );

    server.tool(
      'unassociate_companyies_from_deal',
      'Alias for unassociate_companies_from_deal',
      {
        dealId: z.number().int().describe('The deal ID'),
        companyIds: z
          .array(z.number().int())
          .min(1)
          .describe('Company IDs to remove from the deal'),
      },
      async ({ dealId, companyIds }) => {
        const uniqueCompanyIds = [...new Set(companyIds)];

        for (const companyId of uniqueCompanyIds) {
          await this.dealsService.removeCompany(
            dealId,
            organizationId,
            companyId,
            userId,
          );
        }

        return textResult({
          success: true,
          dealId,
          unassociatedCompanyIds: uniqueCompanyIds,
        });
      },
    );

    server.tool(
      'associate_contacts_with_deal',
      'Associate one or more contacts with a deal using the CRM relation table',
      {
        dealId: z.number().int().describe('The deal ID'),
        contactIds: z
          .array(z.number().int())
          .min(1)
          .describe('Contact IDs to associate with the deal'),
        primaryContactId: z
          .number()
          .int()
          .optional()
          .describe('Optional contact ID to mark as primary'),
        role: z
          .string()
          .optional()
          .describe('Optional role applied to each association'),
      },
      async ({ dealId, contactIds, primaryContactId, role }) => {
        const uniqueContactIds = [...new Set(contactIds)];
        const results = [];

        for (const contactId of uniqueContactIds) {
          const association = await this.dealsService.addContact(
            dealId,
            organizationId,
            {
              contactId,
              role,
              isPrimary: primaryContactId === contactId,
            },
            userId,
          );
          results.push(association);
        }

        return textResult({
          success: true,
          dealId,
          associatedContactIds: uniqueContactIds,
          associations: results,
        });
      },
    );

    server.tool(
      'unassociate_contacts_from_deal',
      'Remove one or more contact associations from a deal',
      {
        dealId: z.number().int().describe('The deal ID'),
        contactIds: z
          .array(z.number().int())
          .min(1)
          .describe('Contact IDs to remove from the deal'),
      },
      async ({ dealId, contactIds }) => {
        const uniqueContactIds = [...new Set(contactIds)];

        for (const contactId of uniqueContactIds) {
          await this.dealsService.removeContact(
            dealId,
            organizationId,
            contactId,
            userId,
          );
        }

        return textResult({
          success: true,
          dealId,
          unassociatedContactIds: uniqueContactIds,
        });
      },
    );

    server.tool(
      'delete_deal',
      'Soft-delete (hide) a deal by its numeric ID',
      { id: z.number().int().describe('The deal ID') },
      async ({ id }) => {
        const existing = await this.dealsRepository.findById(
          id,
          organizationId,
        );
        if (!existing)
          throw new NotFoundException(
            `Deal ${id} not found in this organization`,
          );
        await this.dealsRepository.hide(id);
        return textResult({ success: true, id });
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Contacts
  // ---------------------------------------------------------------------------

  private registerContactTools(
    server: McpServer,
    organizationId: number,
    userId: number,
  ): void {
    server.tool(
      'list_contacts',
      'List contacts in the CRM, optionally filtered by a search term',
      {
        search: z
          .string()
          .optional()
          .describe('Search term for contact name or email'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .default(50)
          .describe('Max results'),
      },
      async ({ search, limit }) => {
        const result = await this.contactsRepository.findAll(
          { organizationId, search, isHidden: false },
          { page: 1, limit: limit ?? 50 },
        );
        return textResult(result);
      },
    );

    server.tool(
      'get_contact',
      'Get a single contact by their numeric ID',
      { id: z.number().int().describe('The contact ID') },
      async ({ id }) => {
        const contact = await this.contactsRepository.findById(
          id,
          organizationId,
        );
        return textResult(contact);
      },
    );

    server.tool(
      'create_contact',
      'Create a new contact in the CRM',
      {
        name: z.string().describe('Full name'),
        email: z.string().optional().describe('Email address'),
        phone: z.string().optional().describe('Phone number'),
        linkedinId: z
          .string()
          .optional()
          .describe('LinkedIn profile URL or ID'),
      },
      async ({ name, email, phone, linkedinId }) => {
        const contact = await this.contactsRepository.create({
          organizationId,
          name,
          email,
          phone,
          linkedinId,
          ownerIds: [userId],
          primaryOwnerId: userId,
        });
        return textResult(contact);
      },
    );

    server.tool(
      'update_contact',
      'Update an existing contact by their numeric ID',
      {
        id: z.number().int().describe('The contact ID'),
        name: z.string().optional().describe('New full name'),
        email: z.string().optional().describe('New email address'),
        phone: z.string().optional().describe('New phone number'),
        linkedinId: z
          .string()
          .optional()
          .describe('New LinkedIn profile URL or ID'),
        fields: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Custom field values'),
      },
      async ({ id, name, email, phone, linkedinId, fields }) => {
        const existing = await this.contactsRepository.findById(
          id,
          organizationId,
        );
        if (!existing)
          throw new NotFoundException(
            `Contact ${id} not found in this organization`,
          );
        const contact = await this.contactsRepository.update(id, {
          name,
          email,
          phone,
          linkedinId,
          fields,
        });
        return textResult(contact);
      },
    );

    server.tool(
      'delete_contact',
      'Soft-delete (hide) a contact by their numeric ID',
      { id: z.number().int().describe('The contact ID') },
      async ({ id }) => {
        const existing = await this.contactsRepository.findById(
          id,
          organizationId,
        );
        if (!existing)
          throw new NotFoundException(
            `Contact ${id} not found in this organization`,
          );
        await this.contactsRepository.hide(id);
        return textResult({ success: true, id });
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Companies
  // ---------------------------------------------------------------------------

  private registerCompanyTools(
    server: McpServer,
    organizationId: number,
    userId: number,
  ): void {
    server.tool(
      'list_companies',
      'List companies in the CRM, optionally filtered by a search term',
      {
        search: z.string().optional().describe('Search term for company name'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .default(50)
          .describe('Max results'),
      },
      async ({ search, limit }) => {
        const result = await this.companiesRepository.findAll(
          { organizationId, search, isHidden: false },
          { page: 1, limit: limit ?? 50 },
        );
        return textResult(result);
      },
    );

    server.tool(
      'get_company',
      'Get a single company by its numeric ID',
      { id: z.number().int().describe('The company ID') },
      async ({ id }) => {
        const company = await this.companiesRepository.findById(
          id,
          organizationId,
        );
        return textResult(company);
      },
    );

    server.tool(
      'create_company',
      'Create a new company in the CRM',
      {
        companyName: z.string().describe('Company name'),
        website: z.string().optional().describe('Website URL'),
        linkedinUrl: z
          .string()
          .optional()
          .describe('LinkedIn company page URL'),
      },
      async ({ companyName, website, linkedinUrl }) => {
        const company = await this.companiesRepository.create({
          organizationId,
          companyName,
          website,
          linkedinUrl,
          ownerIds: [userId],
          primaryOwnerId: userId,
        });
        return textResult(company);
      },
    );

    server.tool(
      'update_company',
      'Update an existing company by its numeric ID',
      {
        id: z.number().int().describe('The company ID'),
        companyName: z.string().optional().describe('New company name'),
        website: z.string().optional().describe('New website URL'),
        linkedinUrl: z
          .string()
          .optional()
          .describe('New LinkedIn company page URL'),
        fields: z
          .record(z.string(), z.unknown())
          .optional()
          .describe('Custom field values'),
      },
      async ({ id, companyName, website, linkedinUrl, fields }) => {
        const existing = await this.companiesRepository.findById(
          id,
          organizationId,
        );
        if (!existing)
          throw new NotFoundException(
            `Company ${id} not found in this organization`,
          );
        const company = await this.companiesRepository.update(id, {
          companyName,
          website,
          linkedinUrl,
          fields,
        });
        return textResult(company);
      },
    );

    server.tool(
      'associate_contact_with_company',
      'Associate a single contact with a company using the CRM relation table',
      {
        companyId: z.number().int().describe('The company ID'),
        contactId: z.number().int().describe('The contact ID'),
        role: z.string().optional().describe('Optional relationship role'),
        isPrimary: z
          .boolean()
          .optional()
          .describe('Whether this is the primary contact-company relation'),
        joinedAt: z
          .string()
          .optional()
          .describe('Optional joined-at date (ISO 8601)'),
      },
      async ({ companyId, contactId, role, isPrimary, joinedAt }) => {
        const association = await this.companiesService.addContact(
          companyId,
          organizationId,
          {
            contactId,
            role,
            isPrimary,
            joinedAt: joinedAt ? new Date(joinedAt) : undefined,
          },
          userId,
        );
        return textResult(association);
      },
    );

    server.tool(
      'unassociate_contact_from_company',
      'Remove a single contact association from a company',
      {
        companyId: z.number().int().describe('The company ID'),
        contactId: z.number().int().describe('The contact ID'),
      },
      async ({ companyId, contactId }) => {
        await this.companiesService.removeContact(
          companyId,
          organizationId,
          contactId,
          userId,
        );
        return textResult({ success: true, companyId, contactId });
      },
    );

    server.tool(
      'associate_contacts_with_company',
      'Associate one or more contacts with a company using the CRM relation table',
      {
        companyId: z.number().int().describe('The company ID'),
        contactIds: z
          .array(z.number().int())
          .min(1)
          .describe('Contact IDs to associate with the company'),
        primaryContactId: z
          .number()
          .int()
          .optional()
          .describe('Optional contact ID to mark as primary'),
        role: z
          .string()
          .optional()
          .describe('Optional role applied to each association'),
        joinedAt: z
          .string()
          .optional()
          .describe(
            'Optional joined-at date (ISO 8601) applied to each association',
          ),
      },
      async ({ companyId, contactIds, primaryContactId, role, joinedAt }) => {
        const uniqueContactIds = [...new Set(contactIds)];
        const results = [];

        for (const contactId of uniqueContactIds) {
          const association = await this.companiesService.addContact(
            companyId,
            organizationId,
            {
              contactId,
              role,
              isPrimary: primaryContactId === contactId,
              joinedAt: joinedAt ? new Date(joinedAt) : undefined,
            },
            userId,
          );
          results.push(association);
        }

        return textResult({
          success: true,
          companyId,
          associatedContactIds: uniqueContactIds,
          associations: results,
        });
      },
    );

    server.tool(
      'unassociate_contacts_from_company',
      'Remove one or more contact associations from a company',
      {
        companyId: z.number().int().describe('The company ID'),
        contactIds: z
          .array(z.number().int())
          .min(1)
          .describe('Contact IDs to remove from the company'),
      },
      async ({ companyId, contactIds }) => {
        const uniqueContactIds = [...new Set(contactIds)];

        for (const contactId of uniqueContactIds) {
          await this.companiesService.removeContact(
            companyId,
            organizationId,
            contactId,
            userId,
          );
        }

        return textResult({
          success: true,
          companyId,
          unassociatedContactIds: uniqueContactIds,
        });
      },
    );

    server.tool(
      'delete_company',
      'Soft-delete (hide) a company by its numeric ID',
      { id: z.number().int().describe('The company ID') },
      async ({ id }) => {
        const existing = await this.companiesRepository.findById(
          id,
          organizationId,
        );
        if (!existing)
          throw new NotFoundException(
            `Company ${id} not found in this organization`,
          );
        await this.companiesRepository.hide(id);
        return textResult({ success: true, id });
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------

  private registerTaskTools(
    server: McpServer,
    organizationId: number,
    userId: number,
  ): void {
    server.tool(
      'list_tasks',
      'List tasks, optionally filtered by status or search term',
      {
        search: z.string().optional().describe('Search term for task title'),
        status: z
          .enum(TASK_STATUS_VALUES)
          .optional()
          .describe('Filter by task status'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .default(50)
          .describe('Max results'),
        page: z
          .number()
          .int()
          .min(1)
          .optional()
          .default(1)
          .describe('Page number'),
      },
      async ({ search, status, limit, page }) => {
        const result = await this.taskRepository.findAll(organizationId, {
          search,
          status: status as TaskStatus | undefined,
          limit: limit ?? 50,
          page: page ?? 1,
        });
        return textResult(result);
      },
    );

    server.tool(
      'get_task',
      'Get a single task by its numeric ID, including subtasks',
      { id: z.number().int().describe('The task ID') },
      async ({ id }) => {
        const task = await this.taskRepository.findById(id, organizationId);
        return textResult(task);
      },
    );

    server.tool(
      'create_task',
      'Create a new task',
      {
        title: z.string().describe('Task title'),
        status: z
          .enum(TASK_STATUS_VALUES)
          .optional()
          .default('TODO')
          .describe('Initial status'),
        assignee: z.string().optional().describe('Assignee name or email'),
        parentId: z
          .number()
          .int()
          .optional()
          .describe('Parent task ID for subtasks'),
      },
      async ({ title, status, assignee, parentId }) => {
        const task = await this.taskRepository.create({
          organizationId,
          title,
          status: (status as TaskStatus) ?? TaskStatus.TODO,
          assignee,
          parentId,
          createdByUserId: userId,
        });
        return textResult(task);
      },
    );

    server.tool(
      'update_task',
      'Update an existing task — change title, status, or assignee',
      {
        id: z.number().int().describe('The task ID'),
        title: z.string().optional().describe('New title'),
        status: z.enum(TASK_STATUS_VALUES).optional().describe('New status'),
        assignee: z.string().optional().describe('New assignee name or email'),
      },
      async ({ id, title, status, assignee }) => {
        const completedAt =
          status === 'DONE'
            ? new Date()
            : status && status !== 'CANCELLED'
              ? null
              : undefined;
        const task = await this.taskRepository.update(id, organizationId, {
          title,
          status: status as TaskStatus | undefined,
          assignee,
          ...(completedAt !== undefined ? { completedAt } : {}),
        });
        return textResult(task);
      },
    );

    server.tool(
      'delete_task',
      'Delete a task by its numeric ID',
      { id: z.number().int().describe('The task ID') },
      async ({ id }) => {
        await this.taskRepository.delete(id, organizationId);
        return textResult({ success: true, id });
      },
    );
  }
}
