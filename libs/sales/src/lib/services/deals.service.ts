import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { PaginationOptions } from '../repositories/types';
import {
  DealsRepository,
  CreateDealInput,
  UpdateDealInput,
  DealFilters,
  AddCompanyToDealInput,
  AddContactToDealInput,
  UpdateContactDealInput,
} from '../repositories/deals.repository';

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(private readonly dealsRepository: DealsRepository) {}

  async create(input: CreateDealInput) {
    this.logger.log('[SERVICE] Starting deal creation');

    // Validate title
    if (!input.title || !input.title.trim()) {
      throw new BadRequestException('Deal title is required');
    }

    // Validate value if provided
    if (input.value !== undefined && input.value < 0) {
      throw new BadRequestException('Deal value cannot be negative');
    }

    // Validate probability if provided
    if (
      input.probability !== undefined &&
      (input.probability < 0 || input.probability > 100)
    ) {
      throw new BadRequestException('Probability must be between 0 and 100');
    }

    // Validate priority if provided
    if (
      input.priority !== undefined &&
      (input.priority < 0 || input.priority > 4)
    ) {
      throw new BadRequestException('Priority must be between 0 and 4');
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

    this.logger.log(
      '[SERVICE] All validations passed, creating deal in database',
    );
    try {
      const result = await this.dealsRepository.create(input);
      this.logger.log(
        `[SERVICE] Deal created successfully with ID: ${result.id}`,
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
    const deal = await this.dealsRepository.findById(id, organizationId);
    if (!deal) {
      throw new NotFoundException(`Deal with ID ${id} not found`);
    }
    return deal;
  }

  async update(id: number, organizationId: number, input: UpdateDealInput) {
    // Check deal exists and belongs to org
    await this.findById(id, organizationId);

    // Validate title if being updated
    if (input.title !== undefined) {
      if (!input.title || !input.title.trim()) {
        throw new BadRequestException('Deal title cannot be empty');
      }
    }

    // Validate value if being updated
    if (input.value !== undefined && input.value < 0) {
      throw new BadRequestException('Deal value cannot be negative');
    }

    // Validate probability if being updated
    if (
      input.probability !== undefined &&
      (input.probability < 0 || input.probability > 100)
    ) {
      throw new BadRequestException('Probability must be between 0 and 100');
    }

    // Validate priority if being updated
    if (
      input.priority !== undefined &&
      (input.priority < 0 || input.priority > 4)
    ) {
      throw new BadRequestException('Priority must be between 0 and 4');
    }

    // Validate actualCloseDate is after expectedCloseDate if both are present
    if (input.actualCloseDate && input.expectedCloseDate) {
      if (input.actualCloseDate < input.expectedCloseDate) {
        this.logger.warn(
          '[SERVICE] Actual close date is before expected close date',
        );
      }
    }

    return this.dealsRepository.update(id, input);
  }

  async hide(id: number, organizationId: number) {
    await this.findById(id, organizationId);
    return this.dealsRepository.hide(id);
  }

  async unhide(id: number, organizationId: number) {
    await this.findById(id, organizationId);
    return this.dealsRepository.unhide(id);
  }

  async findAll(filters: DealFilters, pagination?: PaginationOptions) {
    return this.dealsRepository.findAll(filters, pagination);
  }

  async addOwner(
    dealId: number,
    organizationId: number,
    userId: number,
    isPrimary = false,
  ) {
    await this.findById(dealId, organizationId);
    return this.dealsRepository.addOwner(dealId, userId, isPrimary);
  }

  async removeOwner(dealId: number, organizationId: number, userId: number) {
    await this.findById(dealId, organizationId);
    return this.dealsRepository.removeOwner(dealId, userId);
  }

  async setPrimaryOwner(
    dealId: number,
    organizationId: number,
    userId: number,
  ) {
    await this.findById(dealId, organizationId);
    return this.dealsRepository.setPrimaryOwner(dealId, userId);
  }

  async getDealsByUser(
    organizationId: number,
    userId: number,
    pagination?: PaginationOptions,
  ) {
    return this.dealsRepository.getDealsByUser(
      organizationId,
      userId,
      pagination,
    );
  }

  async addCompany(
    dealId: number,
    organizationId: number,
    input: AddCompanyToDealInput,
  ) {
    this.logger.log(
      `[SERVICE] Adding company ${input.companyId} to deal ${dealId}`,
    );

    await this.findById(dealId, organizationId);

    // Check if company is already associated with this deal
    const existingCompanies = await this.dealsRepository.getCompanies(dealId);
    const alreadyAssociated = existingCompanies.find(
      (da) => da.companyId === input.companyId,
    );

    if (alreadyAssociated) {
      throw new BadRequestException(
        `Company ${input.companyId} is already associated with this deal`,
      );
    }

    try {
      const result = await this.dealsRepository.addCompany(dealId, input);
      this.logger.log(
        `[SERVICE] Company ${input.companyId} added to deal ${dealId} successfully`,
      );
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[SERVICE] Failed to add company to deal: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  async removeCompany(
    dealId: number,
    organizationId: number,
    companyId: number,
  ) {
    this.logger.log(
      `[SERVICE] Removing company ${companyId} from deal ${dealId}`,
    );

    await this.findById(dealId, organizationId);

    try {
      const result = await this.dealsRepository.removeCompany(
        dealId,
        companyId,
      );
      this.logger.log(
        `[SERVICE] Company ${companyId} removed from deal ${dealId} successfully`,
      );
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[SERVICE] Failed to remove company from deal: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  async updateCompany(
    dealId: number,
    organizationId: number,
    companyId: number,
    isPrimary: boolean,
  ) {
    await this.findById(dealId, organizationId);
    return this.dealsRepository.updateCompany(dealId, companyId, isPrimary);
  }

  async getCompanies(dealId: number, organizationId: number) {
    await this.findById(dealId, organizationId);
    return this.dealsRepository.getCompanies(dealId);
  }

  async addContact(
    dealId: number,
    organizationId: number,
    input: AddContactToDealInput,
  ) {
    this.logger.log(
      `[SERVICE] Adding contact ${input.contactId} to deal ${dealId}`,
    );

    await this.findById(dealId, organizationId);

    // Check if contact is already associated with this deal
    const existingContacts = await this.dealsRepository.getContacts(dealId);
    const alreadyAssociated = existingContacts.find(
      (dc) => dc.contactId === input.contactId,
    );

    if (alreadyAssociated) {
      throw new BadRequestException(
        `Contact ${input.contactId} is already associated with this deal`,
      );
    }

    try {
      const result = await this.dealsRepository.addContact(dealId, input);
      this.logger.log(
        `[SERVICE] Contact ${input.contactId} added to deal ${dealId} successfully`,
      );
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[SERVICE] Failed to add contact to deal: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  async removeContact(
    dealId: number,
    organizationId: number,
    contactId: number,
  ) {
    this.logger.log(
      `[SERVICE] Removing contact ${contactId} from deal ${dealId}`,
    );

    await this.findById(dealId, organizationId);

    try {
      const result = await this.dealsRepository.removeContact(
        dealId,
        contactId,
      );
      this.logger.log(
        `[SERVICE] Contact ${contactId} removed from deal ${dealId} successfully`,
      );
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[SERVICE] Failed to remove contact from deal: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  async updateContact(
    dealId: number,
    organizationId: number,
    contactId: number,
    input: UpdateContactDealInput,
  ) {
    await this.findById(dealId, organizationId);
    return this.dealsRepository.updateContact(dealId, contactId, input);
  }

  async getContacts(dealId: number, organizationId: number) {
    await this.findById(dealId, organizationId);
    return this.dealsRepository.getContacts(dealId);
  }

  async getDealsByCompany(
    organizationId: number,
    companyId: number,
    pagination?: PaginationOptions,
  ) {
    return this.dealsRepository.getDealsByCompany(
      organizationId,
      companyId,
      pagination,
    );
  }

  async getDealsByContact(
    organizationId: number,
    contactId: number,
    pagination?: PaginationOptions,
  ) {
    return this.dealsRepository.getDealsByContact(
      organizationId,
      contactId,
      pagination,
    );
  }
}
