import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import {
  AccountsService,
  CreateAccountInput,
  UpdateAccountInput,
  AddContactToAccountInput,
  UpdateContactAccountInput,
} from '@zuko/sales';

// DTOs for API requests
export class CreateAccountDto implements CreateAccountInput {
  companyName: string;
  website?: string;
  linkedinUrl?: string;
  summary?: string;
  ownerIds: number[];
  primaryOwnerId?: number;
}

export class UpdateAccountDto implements Partial<UpdateAccountInput> {
  companyName?: string;
  website?: string;
  linkedinUrl?: string;
  summary?: string;
}

export class AccountListQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  ownerIds?: string; // comma-separated list
  isHidden?: string; // 'true' or 'false'
}

export class AddOwnerDto {
  userId: number;
  isPrimary?: boolean;
}

export class AddContactDto implements AddContactToAccountInput {
  contactId: number;
  role?: string;
  isPrimary?: boolean;
  joinedAt?: Date;
}

export class UpdateContactDto implements UpdateContactAccountInput {
  role?: string;
  isPrimary?: boolean;
}

@Controller('accounts')
@UseGuards(AuthGuard)
export class AccountsController {
  private readonly logger = new Logger(AccountsController.name);

  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateAccountDto) {
    this.logger.log('[CREATE_ACCOUNT] Request received');
    this.logger.debug(
      `[CREATE_ACCOUNT] Payload: ${JSON.stringify({
        companyName: dto.companyName,
        website: dto.website,
        linkedinUrl: dto.linkedinUrl,
        ownerIds: dto.ownerIds,
        primaryOwnerId: dto.primaryOwnerId,
      })}`
    );

    try {
      const result = await this.accountsService.create(dto);
      this.logger.log(`[CREATE_ACCOUNT] Success - Account ID: ${result.id}`);
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[CREATE_ACCOUNT] Failed: ${errorMessage}`,
        errorStack
      );
      throw error;
    }
  }

  @Get()
  async list(@Query() query: AccountListQueryDto) {
    const filters = {
      search: query.search,
      isHidden: query.isHidden === 'true',
      ownerIds: query.ownerIds ? query.ownerIds.split(',').map(Number) : undefined,
    };

    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.accountsService.findAll(filters, pagination);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccountDto
  ) {
    return this.accountsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hide(@Param('id', ParseIntPipe) id: number) {
    await this.accountsService.hide(id);
  }

  @Post(':id/unhide')
  async unhide(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.unhide(id);
  }

  @Post(':id/owners')
  async addOwner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddOwnerDto
  ) {
    return this.accountsService.addOwner(id, dto.userId, dto.isPrimary);
  }

  @Delete(':id/owners/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOwner(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number
  ) {
    await this.accountsService.removeOwner(id, userId);
  }

  @Post(':id/owners/:userId/set-primary')
  async setPrimaryOwner(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number
  ) {
    await this.accountsService.setPrimaryOwner(id, userId);
    return { success: true };
  }

  @Get('user/:userId')
  async getAccountsByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: AccountListQueryDto
  ) {
    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.accountsService.getAccountsByUser(userId, pagination);
  }

  @Post(':id/contacts')
  @HttpCode(HttpStatus.CREATED)
  async addContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddContactDto
  ) {
    this.logger.log(`[ADD_CONTACT_TO_ACCOUNT] Account: ${id}, Contact: ${dto.contactId}`);

    try {
      const result = await this.accountsService.addContact(id, dto);
      this.logger.log(
        `[ADD_CONTACT_TO_ACCOUNT] Success - Contact ${dto.contactId} added to Account ${id}`
      );
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[ADD_CONTACT_TO_ACCOUNT] Failed: ${errorMessage}`,
        errorStack
      );
      throw error;
    }
  }

  @Patch(':id/contacts/:contactId')
  async updateContact(
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body() dto: UpdateContactDto
  ) {
    return this.accountsService.updateContactAccount(id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeContact(
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number
  ) {
    await this.accountsService.removeContact(id, contactId);
  }

  @Get(':id/contacts')
  async getActiveContacts(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.getActiveContacts(id);
  }

  @Get(':id/contacts/history')
  async getContactHistory(@Param('id', ParseIntPipe) id: number) {
    return this.accountsService.getContactHistory(id);
  }
}
