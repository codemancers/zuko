import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { PaginationOptions } from '../repositories/types';
import {
  ContactsRepository,
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
} from '../repositories/contacts.repository';
import { CONTACT_EVENTS, ContactFieldUpdatedEvent } from '../events/contact-events';
import type { ActivitySource } from '../events/deal-events';

/**
 * Validates E.164 phone number format
 * Format: +[country code][subscriber number]
 * Examples: +14155552671, +442071838750
 */
function isValidE164Phone(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

const FIELD_UPDATE_EXCLUDED = new Set<keyof UpdateContactInput>([
  'isHidden', // handled by hide/unhide methods
]);

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private readonly contactsRepository: ContactsRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(input: CreateContactInput, actorId?: number, source?: ActivitySource) {
    this.logger.log('[SERVICE] Starting contact creation');

    // Default Name Support: If no name provided, use "New Contact"
    if (!input.name || input.name.trim() === '') {
      input.name = 'New Contact';
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
          `A contact with email ${input.email} already exists`,
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
      await this.eventEmitter.emitAsync(CONTACT_EVENTS.CREATED, {
        contactId: result.id,
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
    const contact = await this.contactsRepository.findById(id, organizationId);
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }
    return contact;
  }

  async update(id: number, organizationId: number, input: UpdateContactInput, actorId?: number, source?: ActivitySource) {
    // Check contact exists and belongs to org
    const existingContact = await this.contactsRepository.findById(id, organizationId);
    if (!existingContact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    if (input.name !== undefined) {
      if (!input.name || !input.name.trim()) {
        throw new BadRequestException('Contact name cannot be empty');
      }
    }

    if (input.phone && !isValidE164Phone(input.phone)) {
      throw new BadRequestException(
        'Phone number must be in E.164 format (e.g., +14155552671)',
      );
    }

    // Check for duplicate email if being updated (within same organization)
    if (input.email && input.email !== existingContact.email) {
      const duplicateContact = await this.findByEmail(organizationId, input.email);
      if (duplicateContact && duplicateContact.id !== id) {
        throw new BadRequestException(
          `A contact with email ${input.email} already exists (ID: ${duplicateContact.id})`,
        );
      }
    }

    const result = await this.contactsRepository.update(id, input);

    const eventBase = { contactId: id, actorId, source };
    for (const field of Object.keys(input) as Array<keyof UpdateContactInput>) {
      if (FIELD_UPDATE_EXCLUDED.has(field)) continue;
      if (input[field] === undefined) continue;
      const oldVal = existingContact[field as keyof typeof existingContact];
      const newVal = input[field];
      if (String(oldVal) !== String(newVal)) {
        await this.eventEmitter.emitAsync(CONTACT_EVENTS.FIELD_UPDATED, {
          ...eventBase,
          field,
          from: oldVal,
          to: newVal,
        } satisfies ContactFieldUpdatedEvent);
      }
    }

    return result;
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
    actorId?: number,
  ) {
    await this.findById(contactId, organizationId);
    const result = await this.contactsRepository.addOwner(contactId, userId, isPrimary);
    await this.eventEmitter.emitAsync(CONTACT_EVENTS.OWNER_ASSIGNED, {
      contactId,
      actorId,
      userId,
      userName: result.user?.name ?? 'Unknown',
    });
    return result;
  }

  async removeOwner(
    contactId: number,
    organizationId: number,
    userId: number,
    actorId?: number,
  ) {
    await this.findById(contactId, organizationId);
    const result = await this.contactsRepository.removeOwner(contactId, userId);
    await this.eventEmitter.emitAsync(CONTACT_EVENTS.OWNER_REMOVED, {
      contactId,
      actorId,
      userId,
      userName: result.user?.name ?? 'Unknown',
    });
    return result;
  }

  async setPrimaryOwner(
    contactId: number,
    organizationId: number,
    userId: number,
  ) {
    await this.findById(contactId, organizationId);
    return this.contactsRepository.setPrimaryOwner(contactId, userId);
  }

  async getContactsByOwner(
    organizationId: number,
    userId: number,
    pagination?: PaginationOptions,
  ) {
    return this.contactsRepository.getContactsByOwner(
      organizationId,
      userId,
      pagination,
    );
  }
}
