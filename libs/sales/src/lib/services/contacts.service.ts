import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { PaginationOptions } from '../repositories/types';
import {
  ContactsRepository,
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
} from '../repositories/contacts.repository';

/**
 * Validates E.164 phone number format
 * Format: +[country code][subscriber number]
 * Examples: +14155552671, +442071838750
 */
function isValidE164Phone(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Validates that at least one contact method is provided
 */
function validateContactMethods(
  email?: string,
  phone?: string,
  linkedinId?: string,
): void {
  if (!email && !phone && !linkedinId) {
    throw new BadRequestException(
      'At least one of email, phone, or linkedinId must be provided',
    );
  }
}

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly contactsRepository: ContactsRepository) {}

  async create(input: CreateContactInput) {
    this.logger.log('[SERVICE] Starting contact creation');

    // Validate at least one contact method
    this.logger.debug('[SERVICE] Validating contact methods');
    try {
      validateContactMethods(input.email, input.phone, input.linkedinId);
      this.logger.debug('[SERVICE] Contact methods validation passed');
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[SERVICE] Contact methods validation failed: ${errorMessage}`,
      );
      throw error;
    }

    // Validate phone format if provided
    if (input.phone) {
      this.logger.debug(`[SERVICE] Validating phone format: ${input.phone}`);
      if (!isValidE164Phone(input.phone)) {
        this.logger.warn(`[SERVICE] Invalid phone format: ${input.phone}`);
        throw new BadRequestException(
          'Phone number must be in E.164 format (e.g., +14155552671)',
        );
      }
      this.logger.debug('[SERVICE] Phone format validation passed');
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

    // Check for duplicate email (within same organization)
    if (input.email) {
      this.logger.debug(
        `[SERVICE] Checking for duplicate email: ${input.email}`,
      );
      const duplicate = await this.findByEmail(input.organizationId, input.email);
      if (duplicate) {
        this.logger.warn(
          `[SERVICE] Duplicate email found: ${input.email} (existing ID: ${duplicate.id})`,
        );
        throw new BadRequestException(
          `A contact with email ${input.email} already exists (ID: ${duplicate.id})`,
        );
      }
      this.logger.debug('[SERVICE] No duplicate email found');
    }

    this.logger.log(
      '[SERVICE] All validations passed, creating contact in database',
    );
    try {
      const result = await this.contactsRepository.create(input);
      this.logger.log(
        `[SERVICE] Contact created successfully with ID: ${result.id}`,
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
    const contact = await this.contactsRepository.findById(id, organizationId);
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }
    return contact;
  }

  async update(id: number, organizationId: number, input: UpdateContactInput) {
    // Check contact exists and belongs to org
    const contact = await this.contactsRepository.findById(id, organizationId);
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    const updatedEmail =
      input.email !== undefined ? input.email : contact.email;
    const updatedPhone =
      input.phone !== undefined ? input.phone : contact.phone;
    const updatedLinkedinId =
      input.linkedinId !== undefined ? input.linkedinId : contact.linkedinId;

    validateContactMethods(
      updatedEmail ?? undefined,
      updatedPhone ?? undefined,
      updatedLinkedinId ?? undefined,
    );

    // Validate phone format if being updated
    if (input.phone && !isValidE164Phone(input.phone)) {
      throw new BadRequestException(
        'Phone number must be in E.164 format (e.g., +14155552671)',
      );
    }

    // Check for duplicate email if being updated (within same organization)
    if (input.email && input.email !== contact.email) {
      const duplicate = await this.findByEmail(organizationId, input.email);
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException(
          `A contact with email ${input.email} already exists (ID: ${duplicate.id})`,
        );
      }
    }

    return this.contactsRepository.update(id, input);
  }

  async hide(id: number, organizationId: number) {
    await this.findById(id, organizationId);
    return this.contactsRepository.hide(id);
  }

  async unhide(id: number, organizationId: number) {
    await this.findById(id, organizationId);
    return this.contactsRepository.unhide(id);
  }

  async findAll(filters: ContactFilters, pagination?: PaginationOptions) {
    return this.contactsRepository.findAll(filters, pagination);
  }

  async findByEmail(organizationId: number, email: string) {
    const result = await this.contactsRepository.findAll(
      { organizationId, search: email },
      { limit: 100 },
    );
    return result.contacts.find((c) => c.email === email);
  }

  async addOwner(
    contactId: number,
    organizationId: number,
    userId: number,
    isPrimary = false,
  ) {
    await this.findById(contactId, organizationId);
    return this.contactsRepository.addOwner(contactId, userId, isPrimary);
  }

  async removeOwner(
    contactId: number,
    organizationId: number,
    userId: number,
  ) {
    await this.findById(contactId, organizationId);
    return this.contactsRepository.removeOwner(contactId, userId);
  }

  async setPrimaryOwner(
    contactId: number,
    organizationId: number,
    userId: number,
  ) {
    await this.findById(contactId, organizationId);
    return this.contactsRepository.setPrimaryOwner(contactId, userId);
  }

  async getContactsByUser(
    organizationId: number,
    userId: number,
    pagination?: PaginationOptions,
  ) {
    return this.contactsRepository.getContactsByUser(
      organizationId,
      userId,
      pagination,
    );
  }
}
