import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import type { PaginationOptions } from '../repositories/types';
import type {
  DealsRepository,
  CreateDealInput,
  UpdateDealInput,
  DealFilters,
  AddCompanyToDealInput,
  UpdateContactDealInput,
  AddContactToDealInput,
} from '../repositories/deals.repository';
import type { TableColumnRepository } from '../repositories/table-column.repository';
import type {
  DealFieldUpdatedEvent,
  ActivitySource} from '../events/deal-events';
import {
  DEAL_EVENTS
} from '../events/deal-events';
import { DEAL_STAGE_VALUES } from '../constants/deals';
import type { ColumnConfig, ColumnType } from '../types/table-metadata';
import { validateCellValue, castFieldValue } from '../utils/custom-fields';

// Fields handled by dedicated events or not user-visible — excluded from generic field_update
const FIELD_UPDATE_EXCLUDED = new Set<keyof UpdateDealInput>([
  'stage',           // handled by STAGE_CHANGED event
  'actualCloseDate', // handled by CLOSED event
  'lostReason',      // part of CLOSED event metadata
  'isHidden',        // handled by hide/unhide methods
]);

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    private readonly dealsRepository: DealsRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly tableColumnRepository: TableColumnRepository,
  ) {}

  async create(input: CreateDealInput, actorId?: number, source?: ActivitySource) {
    this.logger.log('[SERVICE] Starting deal creation');

    // Default Title Support: If no title provided, use "New Deal"
    if (!input.title || input.title.trim() === '') {
      input.title = 'New Deal';
    }

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

    // Validate stage if provided
    if (input.stage !== undefined && !DEAL_STAGE_VALUES.includes(input.stage)) {
      throw new BadRequestException(`Invalid deal stage: ${input.stage}`);
    }

    // Validate priority if provided
    if (
      input.priority !== undefined &&
      (input.priority < 0 || input.priority > 4)
    ) {
      throw new BadRequestException('Priority must be between 0 and 4');
    }

    this.logger.log(
      '[SERVICE] All validations passed, creating deal in database',
    );
    try {
      const result = await this.dealsRepository.create(input);
      this.logger.log(
        `[SERVICE] Deal created successfully with ID: ${result.id}`,
      );
      await this.eventEmitter.emitAsync(DEAL_EVENTS.CREATED, {
        dealId: result.id,
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
    const deal = await this.dealsRepository.findById(id, organizationId);
    if (!deal) {
      throw new NotFoundException(`Deal with ID ${id} not found`);
    }
    return deal;
  }

  async update(id: number, organizationId: number, input: UpdateDealInput, actorId?: number, source?: ActivitySource) {
    // Check deal exists and belongs to org
    const existingDeal = await this.findById(id, organizationId);

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

    // Validate stage if provided
    if (input.stage !== undefined && !DEAL_STAGE_VALUES.includes(input.stage)) {
      throw new BadRequestException(`Invalid deal stage: ${input.stage}. Must be one of: ${DEAL_STAGE_VALUES.join(', ')}`);
    }

    // Validate actualCloseDate is after expectedCloseDate if both are present
    if (input.actualCloseDate && input.expectedCloseDate) {
      if (input.actualCloseDate < input.expectedCloseDate) {
        this.logger.warn(
          '[SERVICE] Actual close date is before expected close date',
        );
      }
    }

    // Validate custom fields if provided
    if (input.fields) {
      const customColumns = await this.tableColumnRepository.findByTable(
        organizationId,
        'deals',
      );

      for (const [key, value] of Object.entries(input.fields)) {
        const column = customColumns.find((c) => c.columnKey === key);
        if (column) {
          validateCellValue(
            value,
            column.fieldType as ColumnType,
            column.config as ColumnConfig,
          );

          // We should also ensure the value is casted correctly if it's not already
          // although typically the caller should handle this, doing it here ensures consistency.
          input.fields[key] = castFieldValue(value, column.fieldType as ColumnType);
        }
      }
    }

    const result = await this.dealsRepository.update(id, input);

    const eventBase = { dealId: id, actorId, source };

    if (input.stage !== undefined && input.stage !== existingDeal.stage) {
      await this.eventEmitter.emitAsync(DEAL_EVENTS.STAGE_CHANGED, {
        ...eventBase,
        from: existingDeal.stage,
        to: input.stage,
      });
    }

    if (input.actualCloseDate !== undefined && !existingDeal.actualCloseDate) {
      const stage = input.stage ?? existingDeal.stage;
      await this.eventEmitter.emitAsync(DEAL_EVENTS.CLOSED, {
        ...eventBase,
        outcome: stage === 'closed_won' ? 'won' : 'lost',
        lostReason: input.lostReason ?? existingDeal.lostReason ?? undefined,
      });
    }

    for (const field of Object.keys(input) as Array<keyof UpdateDealInput>) {
      if (FIELD_UPDATE_EXCLUDED.has(field)) continue;
      if (input[field] === undefined) continue;
      const oldVal = existingDeal[field as keyof typeof existingDeal];
      const newVal = input[field];
      if (String(oldVal) !== String(newVal)) {
        await this.eventEmitter.emitAsync(DEAL_EVENTS.FIELD_UPDATED, {
          ...eventBase,
          field,
          from: oldVal,
          to: newVal,
        } satisfies DealFieldUpdatedEvent);
      }
    }

    return result;
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
    actorId?: number,
  ) {
    await this.findById(dealId, organizationId);
    const result = await this.dealsRepository.addOwner(dealId, userId, isPrimary);
    await this.eventEmitter.emitAsync(DEAL_EVENTS.OWNER_ASSIGNED, {
      dealId,
      actorId,
      userId,
      userName: result.user?.name ?? 'Unknown',
    });
    return result;
  }

  async removeOwner(dealId: number, organizationId: number, userId: number, actorId?: number) {
    await this.findById(dealId, organizationId);
    const result = await this.dealsRepository.removeOwner(dealId, userId);
    await this.eventEmitter.emitAsync(DEAL_EVENTS.OWNER_REMOVED, {
      dealId,
      actorId,
      userId,
      userName: result.user?.name ?? 'Unknown',
    });
    return result;
  }

  async setPrimaryOwner(
    dealId: number,
    organizationId: number,
    userId: number,
  ) {
    await this.findById(dealId, organizationId);
    return this.dealsRepository.setPrimaryOwner(dealId, userId);
  }

  async getDealsByOwner(
    organizationId: number,
    userId: number,
    pagination?: PaginationOptions,
  ) {
    return this.dealsRepository.getDealsByOwner(
      organizationId,
      userId,
      pagination,
    );
  }

  async addCompany(
    dealId: number,
    organizationId: number,
    input: AddCompanyToDealInput,
    actorId?: number,
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
      await this.eventEmitter.emitAsync(DEAL_EVENTS.COMPANY_LINKED, {
        dealId,
        actorId,
        companyId: input.companyId,
        companyName: result.company.companyName,
      });
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
    actorId?: number,
  ) {
    this.logger.log(
      `[SERVICE] Removing company ${companyId} from deal ${dealId}`,
    );

    await this.findById(dealId, organizationId);

    const companies = await this.dealsRepository.getCompanies(dealId);
    const companyToRemove = companies.find((c) => c.companyId === companyId);
    const companyName = companyToRemove?.company?.companyName ?? 'Unknown';

    try {
      const result = await this.dealsRepository.removeCompany(
        dealId,
        companyId,
      );
      this.logger.log(
        `[SERVICE] Company ${companyId} removed from deal ${dealId} successfully`,
      );
      await this.eventEmitter.emitAsync(DEAL_EVENTS.COMPANY_UNLINKED, {
        dealId,
        actorId,
        companyId,
        companyName,
      });
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
    actorId?: number,
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
      await this.eventEmitter.emitAsync(DEAL_EVENTS.CONTACT_LINKED, {
        dealId,
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
    actorId?: number,
  ) {
    this.logger.log(
      `[SERVICE] Removing contact ${contactId} from deal ${dealId}`,
    );

    await this.findById(dealId, organizationId);

    const contacts = await this.dealsRepository.getContacts(dealId);
    const contactToRemove = contacts.find((c) => c.contactId === contactId);
    const contactName = contactToRemove?.contact?.name ?? 'Unknown';

    try {
      const result = await this.dealsRepository.removeContact(
        dealId,
        contactId,
      );
      this.logger.log(
        `[SERVICE] Contact ${contactId} removed from deal ${dealId} successfully`,
      );
      await this.eventEmitter.emitAsync(DEAL_EVENTS.CONTACT_UNLINKED, {
        dealId,
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
