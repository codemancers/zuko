import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import type { PaginationOptions } from '../repositories/types';
import {
  AccountsRepository,
  CreateAccountInput,
  UpdateAccountInput,
  AccountFilters,
  AddContactToAccountInput,
  UpdateContactAccountInput,
} from '../repositories/accounts.repository';

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
    return parsed.hostname === 'www.linkedin.com' || parsed.hostname === 'linkedin.com';
  } catch {
    return false;
  }
}

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private readonly accountsRepository: AccountsRepository) {}

  async create(input: CreateAccountInput) {
    this.logger.log('[SERVICE] Starting account creation');

    // Validate company name
    if (!input.companyName || !input.companyName.trim()) {
      throw new BadRequestException('Company name is required');
    }

    // Validate website URL if provided
    if (input.website) {
      this.logger.debug(`[SERVICE] Validating website URL: ${input.website}`);
      if (!isValidUrl(input.website)) {
        this.logger.warn(`[SERVICE] Invalid website URL: ${input.website}`);
        throw new BadRequestException('Website must be a valid URL (e.g., https://example.com)');
      }
      this.logger.debug('[SERVICE] Website URL validation passed');
    }

    // Validate LinkedIn URL if provided
    if (input.linkedinUrl) {
      this.logger.debug(`[SERVICE] Validating LinkedIn URL: ${input.linkedinUrl}`);
      if (!isValidLinkedInUrl(input.linkedinUrl)) {
        this.logger.warn(`[SERVICE] Invalid LinkedIn URL: ${input.linkedinUrl}`);
        throw new BadRequestException(
          'LinkedIn URL must be a valid LinkedIn URL (e.g., https://www.linkedin.com/company/example)'
        );
      }
      this.logger.debug('[SERVICE] LinkedIn URL validation passed');
    }

    // Validate at least one owner
    this.logger.debug(`[SERVICE] Validating owners: ${JSON.stringify(input.ownerIds)}`);
    if (!input.ownerIds || input.ownerIds.length === 0) {
      this.logger.warn('[SERVICE] No owners provided');
      throw new BadRequestException('At least one owner must be assigned');
    }
    this.logger.debug(`[SERVICE] Owner validation passed - ${input.ownerIds.length} owner(s)`);

    // Check for duplicate company name (warning only, not blocking)
    const duplicate = await this.findByCompanyName(input.companyName);
    if (duplicate) {
      this.logger.warn(
        `[SERVICE] Account with similar company name already exists: ${input.companyName} (existing ID: ${duplicate.id})`
      );
      // We log but don't block - companies can have similar names
    }

    this.logger.log('[SERVICE] All validations passed, creating account in database');
    try {
      const result = await this.accountsRepository.create(input);
      this.logger.log(`[SERVICE] Account created successfully with ID: ${result.id}`);
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[SERVICE] Database creation failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  async findById(id: number) {
    const account = await this.accountsRepository.findById(id);
    if (!account) {
      throw new NotFoundException(`Account with ID ${id} not found`);
    }
    return account;
  }

  async update(id: number, input: UpdateAccountInput) {
    // Check account exists
    await this.findById(id);

    // Validate company name if being updated
    if (input.companyName !== undefined) {
      if (!input.companyName || !input.companyName.trim()) {
        throw new BadRequestException('Company name cannot be empty');
      }
    }

    // Validate website URL if being updated
    if (input.website !== undefined && input.website) {
      if (!isValidUrl(input.website)) {
        throw new BadRequestException('Website must be a valid URL (e.g., https://example.com)');
      }
    }

    // Validate LinkedIn URL if being updated
    if (input.linkedinUrl !== undefined && input.linkedinUrl) {
      if (!isValidLinkedInUrl(input.linkedinUrl)) {
        throw new BadRequestException(
          'LinkedIn URL must be a valid LinkedIn URL (e.g., https://www.linkedin.com/company/example)'
        );
      }
    }

    return this.accountsRepository.update(id, input);
  }

  async hide(id: number) {
    await this.findById(id);
    return this.accountsRepository.hide(id);
  }

  async unhide(id: number) {
    await this.findById(id);
    return this.accountsRepository.unhide(id);
  }

  async findAll(filters?: AccountFilters, pagination?: PaginationOptions) {
    return this.accountsRepository.findAll(filters, pagination);
  }

  async findByCompanyName(companyName: string) {
    const result = await this.accountsRepository.findAll({ search: companyName });
    return result.accounts.find(
      (a) => a.companyName.toLowerCase() === companyName.toLowerCase()
    );
  }

  async addOwner(accountId: number, userId: number, isPrimary = false) {
    await this.findById(accountId);
    return this.accountsRepository.addOwner(accountId, userId, isPrimary);
  }

  async removeOwner(accountId: number, userId: number) {
    await this.findById(accountId);
    return this.accountsRepository.removeOwner(accountId, userId);
  }

  async setPrimaryOwner(accountId: number, userId: number) {
    await this.findById(accountId);
    return this.accountsRepository.setPrimaryOwner(accountId, userId);
  }

  async getAccountsByUser(userId: number, pagination?: PaginationOptions) {
    return this.accountsRepository.getAccountsByUser(userId, pagination);
  }

  async addContact(accountId: number, input: AddContactToAccountInput) {
    this.logger.log(`[SERVICE] Adding contact ${input.contactId} to account ${accountId}`);

    await this.findById(accountId);

    // Check if contact is already active in this account
    const existingActive = await this.accountsRepository.getActiveContacts(accountId);
    const alreadyActive = existingActive.find((ac) => ac.contactId === input.contactId);

    if (alreadyActive) {
      throw new BadRequestException(
        `Contact ${input.contactId} is already an active member of this account`
      );
    }

    try {
      const result = await this.accountsRepository.addContact(accountId, input);
      this.logger.log(
        `[SERVICE] Contact ${input.contactId} added to account ${accountId} successfully`
      );
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[SERVICE] Failed to add contact to account: ${errorMessage}`,
        errorStack
      );
      throw error;
    }
  }

  async removeContact(accountId: number, contactId: number) {
    this.logger.log(`[SERVICE] Removing contact ${contactId} from account ${accountId}`);

    await this.findById(accountId);

    try {
      const result = await this.accountsRepository.removeContact(accountId, contactId);
      this.logger.log(
        `[SERVICE] Contact ${contactId} removed from account ${accountId} successfully`
      );
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[SERVICE] Failed to remove contact from account: ${errorMessage}`,
        errorStack
      );
      throw error;
    }
  }

  async updateContactAccount(
    accountId: number,
    contactId: number,
    input: UpdateContactAccountInput
  ) {
    await this.findById(accountId);
    return this.accountsRepository.updateContactAccount(accountId, contactId, input);
  }

  async getActiveContacts(accountId: number) {
    await this.findById(accountId);
    return this.accountsRepository.getActiveContacts(accountId);
  }

  async getContactHistory(accountId: number) {
    await this.findById(accountId);
    return this.accountsRepository.getContactHistory(accountId);
  }

  async getAccountsForContact(contactId: number, includeHistory = false) {
    return this.accountsRepository.getAccountsForContact(contactId, includeHistory);
  }
}
