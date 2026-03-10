import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { PaginationOptions } from '../repositories/types';
import {
  CompaniesRepository,
  CreateCompanyInput,
  UpdateCompanyInput,
  CompanyFilters,
  AddContactToCompanyInput,
  UpdateContactCompanyInput,
} from '../repositories/companies.repository';

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

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(private readonly companiesRepository: CompaniesRepository) {}

  async create(input: CreateCompanyInput) {
    this.logger.log('[SERVICE] Starting company creation');

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

    // Validate at least one owner
    this.logger.debug(
      `[SERVICE] Validating owners: ${JSON.stringify(input.ownerIds)}`,
    );
    if (!input.ownerIds || input.ownerIds.length === 0) {
      this.logger.warn('[SERVICE] No owners provided');
      throw new BadRequestException('At least one owner must be assigned');
    }
    this.logger.debug(
      `[SERVICE] Owner validation passed - ${input.ownerIds.length} owner(s)`,
    );

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

  async update(id: number, organizationId: number, input: UpdateCompanyInput) {
    // Check company exists and belongs to org
    await this.findById(id, organizationId);

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

    return this.companiesRepository.update(id, input);
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
  ) {
    await this.findById(companyId, organizationId);
    return this.companiesRepository.addOwner(companyId, userId, isPrimary);
  }

  async removeOwner(
    companyId: number,
    organizationId: number,
    userId: number,
  ) {
    await this.findById(companyId, organizationId);
    return this.companiesRepository.removeOwner(companyId, userId);
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
  ) {
    this.logger.log(
      `[SERVICE] Removing contact ${contactId} from company ${companyId}`,
    );

    await this.findById(companyId, organizationId);

    try {
      const result = await this.companiesRepository.removeContact(
        companyId,
        contactId,
      );
      this.logger.log(
        `[SERVICE] Contact ${contactId} removed from company ${companyId} successfully`,
      );
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
