import {
  Controller,
  Get,
  Post,
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
  ContactsService,
  CreateContactInput,
  UpdateContactInput,
} from '@zuko/sales';

// DTOs for API requests
export class CreateContactDto implements CreateContactInput {
  name!: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: string;
  ownerIds!: number[];
  primaryOwnerId?: number;
}

export class UpdateContactDto implements Partial<UpdateContactInput> {
  name?: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: string;
}

export class ContactListQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  ownerIds?: string; // comma-separated list
  isHidden?: string; // 'true' or 'false'
}

export class AddOwnerDto {
  userId!: number;
  isPrimary?: boolean;
}

@Controller('contacts')
@UseGuards(AuthGuard)
export class ContactsController {
  private readonly logger = new Logger(ContactsController.name);

  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateContactDto) {
    this.logger.log('[CREATE_CONTACT] Request received');
    this.logger.debug(
      `[CREATE_CONTACT] Payload: ${JSON.stringify({
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        linkedinId: dto.linkedinId,
        ownerIds: dto.ownerIds,
        primaryOwnerId: dto.primaryOwnerId,
        hasNotes: !!dto.notes,
      })}`
    );

    try {
      const result = await this.contactsService.create(dto);
      this.logger.log(`[CREATE_CONTACT] Success - Contact ID: ${result.id}`);
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[CREATE_CONTACT] Failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  @Get()
  async list(@Query() query: ContactListQueryDto) {
    const filters = {
      search: query.search,
      isHidden: query.isHidden === 'true',
      ownerIds: query.ownerIds
        ? query.ownerIds.split(',').map(Number)
        : undefined,
    };

    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.contactsService.findAll(filters, pagination);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContactDto
  ) {
    return this.contactsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hide(@Param('id', ParseIntPipe) id: number) {
    await this.contactsService.hide(id);
  }

  @Post(':id/unhide')
  async unhide(@Param('id', ParseIntPipe) id: number) {
    return this.contactsService.unhide(id);
  }

  @Post(':id/owners')
  async addOwner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddOwnerDto
  ) {
    return this.contactsService.addOwner(id, dto.userId, dto.isPrimary);
  }

  @Delete(':id/owners/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOwner(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number
  ) {
    await this.contactsService.removeOwner(id, userId);
  }

  @Post(':id/owners/:userId/set-primary')
  async setPrimaryOwner(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number
  ) {
    await this.contactsService.setPrimaryOwner(id, userId);
    return { success: true };
  }

  @Get('user/:userId')
  async getContactsByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: ContactListQueryDto
  ) {
    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.contactsService.getContactsByUser(userId, pagination);
  }
}
