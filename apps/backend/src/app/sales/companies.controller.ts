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
import { CompaniesService } from '@zuko/sales';
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
  AddContactToCompanyInput,
  UpdateContactCompanyInput,
  EditorData,
} from '@zuko/sales';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';

// DTOs for API requests (organizationId is set from session via OrganizationGuard)
export class CreateCompanyDto implements Omit<
  CreateCompanyInput,
  'organizationId'
> {
  companyName!: string;
  website?: string;
  linkedinUrl?: string;
  summary?: EditorData;
  ownerIds?: number[];
  primaryOwnerId?: number;
  fields?: Record<string, unknown>;
}

export class UpdateCompanyDto implements Partial<UpdateCompanyInput> {
  companyName?: string;
  website?: string;
  linkedinUrl?: string;
  summary?: EditorData;
  isHidden?: boolean;
  fields?: Record<string, unknown>;
}

export class CompanyListQueryDto {
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

export class AddContactDto implements AddContactToCompanyInput {
  contactId!: number;
  role?: string;
  isPrimary?: boolean;
  joinedAt?: Date;
}

export class UpdateContactDto implements UpdateContactCompanyInput {
  role?: string;
  isPrimary?: boolean;
}

@Controller('companies')
@UseGuards(AuthGuard, OrganizationGuard)
export class CompaniesController {
  private readonly logger = new Logger(CompaniesController.name);

  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @OrgId() organizationId: number,
    @Body() dto: CreateCompanyDto,
    @Req() req: RequestWithUser,
  ) {
    this.logger.log('[CREATE_COMPANY] Request received');
    this.logger.debug(
      `[CREATE_COMPANY] Payload: ${JSON.stringify({
        companyName: dto.companyName,
        website: dto.website,
        linkedinUrl: dto.linkedinUrl,
        ownerIds: dto.ownerIds,
        primaryOwnerId: dto.primaryOwnerId,
      })}`,
    );

    try {
      const actorId = parseInt(req.user.id, 10);
      const result = await this.companiesService.create(
        { ...dto, organizationId },
        actorId,
      );
      this.logger.log(`[CREATE_COMPANY] Success - Company ID: ${result.id}`);
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[CREATE_COMPANY] Failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  @Get()
  async list(
    @OrgId() organizationId: number,
    @Query() query: CompanyListQueryDto,
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

    return this.companiesService.findAll(filters, pagination);
  }

  @Get(':id')
  async findOne(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.companiesService.findById(id, organizationId);
  }

  @Patch(':id')
  async update(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
    @Req() req: RequestWithUser,
  ) {
    const actorId = parseInt(req.user.id, 10);
    return this.companiesService.update(id, organizationId, dto, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.companiesService.hide(id, organizationId);
  }

  @Post(':id/unhide')
  async unhide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.companiesService.unhide(id, organizationId);
  }

  @Post(':id/owners')
  async addOwner(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddOwnerDto,
    @Req() req: RequestWithUser,
  ) {
    const actorId = parseInt(req.user.id, 10);
    return this.companiesService.addOwner(
      id,
      organizationId,
      dto.userId,
      dto.isPrimary,
      actorId,
    );
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
    await this.companiesService.removeOwner(
      id,
      organizationId,
      userId,
      actorId,
    );
  }

  @Post(':id/owners/:userId/set-primary')
  async setPrimaryOwner(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.companiesService.setPrimaryOwner(id, organizationId, userId);
    return { success: true };
  }

  @Get('user/:userId')
  async getCompaniesByOwner(
    @OrgId() organizationId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: CompanyListQueryDto,
  ) {
    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.companiesService.getCompaniesByOwner(
      organizationId,
      userId,
      pagination,
    );
  }

  @Post(':id/contacts')
  @HttpCode(HttpStatus.CREATED)
  async addContact(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddContactDto,
    @Req() req: RequestWithUser,
  ) {
    this.logger.log(
      `[ADD_CONTACT_TO_COMPANY] Company: ${id}, Contact: ${dto.contactId}`,
    );

    try {
      const actorId = parseInt(req.user.id, 10);
      const result = await this.companiesService.addContact(
        id,
        organizationId,
        dto,
        actorId,
      );
      this.logger.log(
        `[ADD_CONTACT_TO_COMPANY] Success - Contact ${dto.contactId} added to Company ${id}`,
      );
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[ADD_CONTACT_TO_COMPANY] Failed: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  @Patch(':id/contacts/:contactId')
  async updateContact(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body() dto: UpdateContactDto,
  ) {
    return this.companiesService.updateContactCompany(
      id,
      organizationId,
      contactId,
      dto,
    );
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeContact(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Req() req: RequestWithUser,
  ) {
    const actorId = parseInt(req.user.id, 10);
    await this.companiesService.removeContact(
      id,
      organizationId,
      contactId,
      actorId,
    );
  }

  @Get(':id/contacts')
  async getActiveContacts(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.companiesService.getActiveContacts(id, organizationId);
  }

  @Get(':id/contacts/history')
  async getContactHistory(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.companiesService.getContactHistory(id, organizationId);
  }
}
