import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PaginationOptions } from '../repositories/types';
import { CompaniesRepository } from '../repositories/companies.repository';
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
  CompanyFilters,
  AddContactToCompanyInput,
  UpdateContactCompanyInput,
} from '../repositories/companies.repository';
import { TableColumnRepository } from '../repositories/table-column.repository';
import type { CompanyFieldUpdatedEvent } from '../events/company-events';
import { COMPANY_EVENTS } from '../events/company-events';
import type { ActivitySource } from '../events/deal-events';
import type { ColumnConfig, ColumnType } from '../types/table-metadata';
import { validateCellValue, castFieldValue } from '../utils/custom-fields';

/**
 * Validates URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates LinkedIn URL format
 */
function isValidLinkedInUrl(url: string): boolean {
  if (!isValidUrl(url)) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'www.linkedin.com' ||
      parsed.hostname === 'linkedin.com'
    );
  } catch {
    return false;
  }
}

const FIELD_UPDATE_EXCLUDED = new Set<keyof UpdateCompanyInput>([
  'isHidden', // handled by hide/unhide methods
]);

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly companiesRepository: CompaniesRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly tableColumnRepository: TableColumnRepository,
  ) {}

  async create(
    input: CreateCompanyInput,
    actorId?: number,
    source?: ActivitySource,
  ) {
    this.logger.log('[SERVICE] Starting company creation');

    // Default Name Support: If no name provided, use "New Company"
    if (!input.companyName || input.companyName.trim() === '') {
      input.companyName = 'New Company';
    }

    // Validate company name
    if (!input.companyName || !input.companyName.trim()) {
      throw new BadRequestException('Company name is required');
    }

    // Validate website URL if provided
    if (input.website) {
      this.logger.debug(`[SERVICE] Validating website URL: ${input.website}`);
      if (!isValidUrl(input.website)) {
        this.logger.warn(`[SERVICE] Invalid website URL: ${input.website}`);
        throw new BadRequestException(
          'Website must be a valid URL (e.g., https://example.com)',
        );
      }
      this.logger.debug('[SERVICE] Website URL validation passed');
    }

    // Validate LinkedIn URL if provided
    if (input.linkedinUrl) {
      this.logger.debug(
        `[SERVICE] Validating LinkedIn URL: ${input.linkedinUrl}`,
      );
      if (!isValidLinkedInUrl(input.linkedinUrl)) {
        this.logger.warn(
          `[SERVICE] Invalid LinkedIn URL: ${input.linkedinUrl}`,
        );
        throw new BadRequestException(
          'LinkedIn URL must be a valid LinkedIn URL (e.g., https://www.linkedin.com/company/example)',
        );
      }
      this.logger.debug('[SERVICE] LinkedIn URL validation passed');
    }

    // Check for duplicate company name (warning only, not blocking)
    const duplicate = await this.findByCompanyName(
      input.organizationId,
      input.companyName,
    );
    if (duplicate) {
      this.logger.warn(
        `[SERVICE] Company with similar name already exists: ${input.companyName} (existing ID: ${duplicate.id})`,
      );
      // We log but don't block - companies can have similar names
    }

    this.logger.log(
      '[SERVICE] All validations passed, creating company in database',
    );
    try {
      const result = await this.companiesRepository.create(input);
      this.logger.log(
        `[SERVICE] Company created successfully with ID: ${result.id}`,
      );
      await this.eventEmitter.emitAsync(COMPANY_EVENTS.CREATED, {
        companyId: result.id,
        actorId,
        source,
      });
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[SERVICE] Database creation failed: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  async findById(id: number, organizationId: number) {
    const company = await this.companiesRepository.findById(id, organizationId);
    if (!company) {
      throw new NotFoundException(`Company with ID ${id} not found`);
    }
    return company;
  }

  async update(
    id: number,
    organizationId: number,
    input: UpdateCompanyInput,
    actorId?: number,
    source?: ActivitySource,
  ) {
    const existingCompany = await this.findById(id, organizationId);

    // Validate company name if being updated
    if (input.companyName !== undefined) {
      if (!input.companyName || !input.companyName.trim()) {
        throw new BadRequestException('Company name cannot be empty');
      }
    }

    // Validate website URL if being updated
    if (input.website !== undefined && input.website) {
      if (!isValidUrl(input.website)) {
        throw new BadRequestException(
          'Website must be a valid URL (e.g., https://example.com)',
        );
      }
    }

    // Validate LinkedIn URL if being updated
    if (input.linkedinUrl !== undefined && input.linkedinUrl) {
      if (!isValidLinkedInUrl(input.linkedinUrl)) {
        throw new BadRequestException(
          'LinkedIn URL must be a valid LinkedIn URL (e.g., https://www.linkedin.com/company/example)',
        );
      }
    }

    // Validate custom fields if provided
    if (input.fields) {
      const customColumns = await this.tableColumnRepository.findByTable(
        organizationId,
        'companies',
      );

      for (const [key, value] of Object.entries(input.fields)) {
        const column = customColumns.find((c) => c.columnKey === key);
        if (column) {
          validateCellValue(
            value,
            column.fieldType as ColumnType,
            column.config as ColumnConfig,
          );
          input.fields[key] = castFieldValue(
            value,
            column.fieldType as ColumnType,
          );
        }
      }
    }

    const result = await this.companiesRepository.update(id, input);

    const eventBase = { companyId: id, actorId, source };
    for (const field of Object.keys(input) as Array<keyof UpdateCompanyInput>) {
      if (FIELD_UPDATE_EXCLUDED.has(field)) continue;
      if (input[field] === undefined) continue;
      const oldVal = existingCompany[field as keyof typeof existingCompany];
      const newVal = input[field];
      if (String(oldVal) !== String(newVal)) {
        await this.eventEmitter.emitAsync(COMPANY_EVENTS.FIELD_UPDATED, {
          ...eventBase,
          field,
          from: oldVal,
          to: newVal,
        } satisfies CompanyFieldUpdatedEvent);
      }
    }

    return result;
  }

  async hide(id: number, organizationId: number) {
    await this.findById(id, organizationId);
    return this.companiesRepository.hide(id);
  }

  async unhide(id: number, organizationId: number) {
    await this.findById(id, organizationId);
    return this.companiesRepository.unhide(id);
  }

  async findAll(filters: CompanyFilters, pagination?: PaginationOptions) {
    return this.companiesRepository.findAll(filters, pagination);
  }

  async findByCompanyName(organizationId: number, companyName: string) {
    const result = await this.companiesRepository.findAll({
      organizationId,
      search: companyName,
    });
    return result.companies.find(
      (a) => a.companyName.toLowerCase() === companyName.toLowerCase(),
    );
  }

  async addOwner(
    companyId: number,
    organizationId: number,
    userId: number,
    isPrimary = false,
    actorId?: number,
  ) {
    await this.findById(companyId, organizationId);
    const result = await this.companiesRepository.addOwner(
      companyId,
      userId,
      isPrimary,
    );
    await this.eventEmitter.emitAsync(COMPANY_EVENTS.OWNER_ASSIGNED, {
      companyId,
      actorId,
      userId,
      userName: result.user?.name ?? 'Unknown',
    });
    return result;
  }

  async removeOwner(
    companyId: number,
    organizationId: number,
    userId: number,
    actorId?: number,
  ) {
    await this.findById(companyId, organizationId);
    const result = await this.companiesRepository.removeOwner(
      companyId,
      userId,
    );
    await this.eventEmitter.emitAsync(COMPANY_EVENTS.OWNER_REMOVED, {
      companyId,
      actorId,
      userId,
      userName: result.user?.name ?? 'Unknown',
    });
    return result;
  }

  async setPrimaryOwner(
    companyId: number,
    organizationId: number,
    userId: number,
  ) {
    await this.findById(companyId, organizationId);
    return this.companiesRepository.setPrimaryOwner(companyId, userId);
  }

  async getCompaniesByOwner(
    organizationId: number,
    userId: number,
    pagination?: PaginationOptions,
  ) {
    return this.companiesRepository.getCompaniesByOwner(
      organizationId,
      userId,
      pagination,
    );
  }

  async addContact(
    companyId: number,
    organizationId: number,
    input: AddContactToCompanyInput,
    actorId?: number,
  ) {
    this.logger.log(
      `[SERVICE] Adding contact ${input.contactId} to company ${companyId}`,
    );

    await this.findById(companyId, organizationId);

    // Check if contact is already active in this company
    const existingActive =
      await this.companiesRepository.getActiveContacts(companyId);
    const alreadyActive = existingActive.find(
      (ac) => ac.contactId === input.contactId,
    );

    if (alreadyActive) {
      throw new BadRequestException(
        `Contact ${input.contactId} is already an active member of this company`,
      );
    }

    try {
      const result = await this.companiesRepository.addContact(
        companyId,
        input,
      );
      this.logger.log(
        `[SERVICE] Contact ${input.contactId} added to company ${companyId} successfully`,
      );
      await this.eventEmitter.emitAsync(COMPANY_EVENTS.CONTACT_LINKED, {
        companyId,
        actorId,
        contactId: input.contactId,
        contactName: result.contact.name,
        ...(input.role && { role: input.role }),
      });
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[SERVICE] Failed to add contact to company: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  async removeContact(
    companyId: number,
    organizationId: number,
    contactId: number,
    actorId?: number,
  ) {
    this.logger.log(
      `[SERVICE] Removing contact ${contactId} from company ${companyId}`,
    );

    await this.findById(companyId, organizationId);

    const activeContacts =
      await this.companiesRepository.getActiveContacts(companyId);
    const contactToRemove = activeContacts.find(
      (c) => c.contactId === contactId,
    );
    const contactName = contactToRemove?.contact?.name ?? 'Unknown';

    try {
      const result = await this.companiesRepository.removeContact(
        companyId,
        contactId,
      );
      this.logger.log(
        `[SERVICE] Contact ${contactId} removed from company ${companyId} successfully`,
      );
      await this.eventEmitter.emitAsync(COMPANY_EVENTS.CONTACT_UNLINKED, {
        companyId,
        actorId,
        contactId,
        contactName,
      });
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[SERVICE] Failed to remove contact from company: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  async updateContactCompany(
    companyId: number,
    organizationId: number,
    contactId: number,
    input: UpdateContactCompanyInput,
  ) {
    await this.findById(companyId, organizationId);
    return this.companiesRepository.updateContactCompany(
      companyId,
      contactId,
      input,
    );
  }

  async getActiveContacts(companyId: number, organizationId: number) {
    await this.findById(companyId, organizationId);
    return this.companiesRepository.getActiveContacts(companyId);
  }

  async getContactHistory(companyId: number, organizationId: number) {
    await this.findById(companyId, organizationId);
    return this.companiesRepository.getContactHistory(companyId);
  }

  async getCompaniesForContact(contactId: number, includeHistory = false) {
    return this.companiesRepository.getCompaniesForContact(
      contactId,
      includeHistory,
    );
  }
}
