import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import type { RequestWithUser } from '@zuko/core';
import { ContactsService } from '@zuko/sales';
import type {
  CreateContactInput,
  UpdateContactInput,
  EditorData,
} from '@zuko/sales';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';

// DTOs for API requests (organizationId is set from session via OrganizationGuard)
export class CreateContactDto implements Omit<
  CreateContactInput,
  'organizationId'
> {
  @ApiProperty({ example: 'Jane Smith' })
  name!: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  email?: string;

  @ApiPropertyOptional({ example: '+1-555-000-0000' })
  phone?: string;

  @ApiPropertyOptional({ example: 'jane-smith-123' })
  linkedinId?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Rich-text notes (EditorJS format)',
  })
  notes?: EditorData;

  @ApiPropertyOptional({ type: [Number], example: [1, 2] })
  ownerIds?: number[];

  @ApiPropertyOptional({ type: Number, example: 1 })
  primaryOwnerId?: number;

  @ApiPropertyOptional({ type: Object, description: 'Custom field values' })
  fields?: Record<string, unknown>;
}

export class UpdateContactDto implements Partial<UpdateContactInput> {
  @ApiPropertyOptional({ example: 'Jane Smith' })
  name?: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  email?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  linkedinId?: string;

  @ApiPropertyOptional({ type: Object })
  notes?: EditorData;

  @ApiPropertyOptional({ type: Object })
  fields?: Record<string, unknown>;
}

export class ContactListQueryDto {
  @ApiPropertyOptional({ type: Number, example: 1 })
  page?: number;

  @ApiPropertyOptional({ type: Number, example: 50 })
  limit?: number;

  @ApiPropertyOptional({ type: String, example: 'jane' })
  search?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated owner user IDs',
    example: '1,2',
  })
  ownerIds?: string;

  @ApiPropertyOptional({ type: String, enum: ['true', 'false'] })
  isHidden?: string;
}

export class AddOwnerDto {
  @ApiProperty({ type: Number, example: 1 })
  userId!: number;

  @ApiPropertyOptional({ type: Boolean })
  isPrimary?: boolean;
}

@ApiTags('Contacts')
@ApiBearerAuth('session')
@Controller('contacts')
@UseGuards(AuthGuard, OrganizationGuard)
export class ContactsController {
  private readonly logger = new Logger(ContactsController.name);

  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new contact' })
  @ApiResponse({ status: 201, description: 'Contact created' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async create(
    @OrgId() organizationId: number,
    @Body() dto: CreateContactDto,
    @Req() req: RequestWithUser,
  ) {
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
      })}`,
    );

    try {
      const actorId = parseInt(req.user.id, 10);
      const result = await this.contactsService.create(
        { ...dto, organizationId },
        actorId,
      );
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
  @ApiOperation({ summary: 'List contacts with optional filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'ownerIds',
    required: false,
    type: String,
    description: 'Comma-separated owner IDs',
  })
  @ApiQuery({
    name: 'isHidden',
    required: false,
    type: String,
    enum: ['true', 'false'],
  })
  @ApiResponse({ status: 200, description: 'Paginated contact list' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async list(
    @OrgId() organizationId: number,
    @Query() query: ContactListQueryDto,
  ) {
    const filters = {
      organizationId,
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
  @ApiOperation({ summary: 'Get a contact by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Contact details' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async findOne(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.contactsService.findById(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a contact' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Updated contact' })
  async update(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContactDto,
    @Req() req: RequestWithUser,
  ) {
    const actorId = parseInt(req.user.id, 10);
    return this.contactsService.update(id, organizationId, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hide (soft-delete) a contact' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Contact hidden' })
  async hide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.contactsService.hide(id, organizationId);
  }

  @Post(':id/unhide')
  @ApiOperation({ summary: 'Restore a hidden contact' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Contact restored' })
  async unhide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.contactsService.unhide(id, organizationId);
  }

  @Post(':id/owners')
  @ApiOperation({ summary: 'Add an owner to a contact' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Owner added' })
  async addOwner(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddOwnerDto,
    @Req() req: RequestWithUser,
  ) {
    const actorId = parseInt(req.user.id, 10);
    return this.contactsService.addOwner(
      id,
      organizationId,
      dto.userId,
      dto.isPrimary,
      actorId,
    );
  }

  @Delete(':id/owners/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an owner from a contact' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 204, description: 'Owner removed' })
  async removeOwner(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: RequestWithUser,
  ) {
    const actorId = parseInt(req.user.id, 10);
    await this.contactsService.removeOwner(id, organizationId, userId, actorId);
  }

  @Post(':id/owners/:userId/set-primary')
  @ApiOperation({ summary: 'Set a primary owner for a contact' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 200, description: 'Primary owner set' })
  async setPrimaryOwner(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.contactsService.setPrimaryOwner(id, organizationId, userId);
    return { success: true };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'List contacts owned by a specific user' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 200, description: 'Contact list' })
  async getContactsByOwner(
    @OrgId() organizationId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: ContactListQueryDto,
  ) {
    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.contactsService.getContactsByOwner(
      organizationId,
      userId,
      pagination,
    );
  }
}
