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
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import type { RequestWithUser } from '@zuko/core';
import type {
  ContactsService,
  CreateContactInput,
  UpdateContactInput,
  EditorData,
} from '@zuko/sales';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';

// DTOs for API requests (organizationId is set from session via OrganizationGuard)
export class CreateContactDto
  implements Omit<CreateContactInput, 'organizationId'>
{
  name!: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: EditorData;
  ownerIds?: number[];
  primaryOwnerId?: number;
  fields?: Record<string, unknown>; // for custom fields
}

export class UpdateContactDto implements Partial<UpdateContactInput> {
  name?: string;
  email?: string;
  phone?: string;
  linkedinId?: string;
  notes?: EditorData;
  fields?: Record<string, unknown>; // for custom fields
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
@UseGuards(AuthGuard, OrganizationGuard)
export class ContactsController {
  private readonly logger = new Logger(ContactsController.name);

  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
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
      const result = await this.contactsService.create({ ...dto, organizationId }, actorId);
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
  async findOne(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.contactsService.findById(id, organizationId);
  }

  @Patch(':id')
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
  async hide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.contactsService.hide(id, organizationId);
  }

  @Post(':id/unhide')
  async unhide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.contactsService.unhide(id, organizationId);
  }

  @Post(':id/owners')
  async addOwner(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddOwnerDto,
    @Req() req: RequestWithUser,
  ) {
    const actorId = parseInt(req.user.id, 10);
    return this.contactsService.addOwner(id, organizationId, dto.userId, dto.isPrimary, actorId);
  }

  @Delete(':id/owners/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
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
  async setPrimaryOwner(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.contactsService.setPrimaryOwner(id, organizationId, userId);
    return { success: true };
  }

  @Get('user/:userId')
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
