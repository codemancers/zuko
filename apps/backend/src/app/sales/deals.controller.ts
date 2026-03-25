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
import {
  DealsService,
  CreateDealInput,
  UpdateDealInput,
  AddCompanyToDealInput,
  AddContactToDealInput,
  UpdateContactDealInput,
} from '@zuko/sales';
import type { RequestWithUser } from '@zuko/core';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';

// DTOs for API requests (organizationId is set from session via OrganizationGuard)
export class CreateDealDto implements Omit<CreateDealInput, 'organizationId'> {
  title!: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: string;
  summary?: string;
  expectedCloseDate?: Date;
  source?: string;
  priority?: number;
  ownerIds?: number[];
  primaryOwnerId?: number;
  fields?: Record<string, unknown>;
}

export class UpdateDealDto implements Partial<UpdateDealInput> {
  title?: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: string;
  summary?: string;
  expectedCloseDate?: Date;
  actualCloseDate?: Date;
  lostReason?: string;
  source?: string;
  priority?: number;
  fields?: Record<string, unknown>;
}

export class DealListQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  ownerIds?: string; // comma-separated list
  companyIds?: string; // comma-separated list
  contactIds?: string; // comma-separated list
  stages?: string; // comma-separated list
  minValue?: number;
  maxValue?: number;
  expectedCloseFrom?: string; // ISO date string
  expectedCloseTo?: string; // ISO date string
  isHidden?: string; // 'true' or 'false'
}

export class AddOwnerDto {
  userId!: number;
  isPrimary?: boolean;
}

export class AddCompanyDto implements AddCompanyToDealInput {
  companyId!: number;
  isPrimary?: boolean;
}

export class UpdateCompanyDto {
  isPrimary!: boolean;
}

export class AddContactDto implements AddContactToDealInput {
  contactId!: number;
  role?: string;
  isPrimary?: boolean;
}

export class UpdateContactDto implements UpdateContactDealInput {
  role?: string;
  isPrimary?: boolean;
}

@Controller('deals')
@UseGuards(AuthGuard, OrganizationGuard)
export class DealsController {
  private readonly logger = new Logger(DealsController.name);

  constructor(private readonly dealsService: DealsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: RequestWithUser, @OrgId() organizationId: number, @Body() dto: CreateDealDto) {
    this.logger.log('[CREATE_DEAL] Request received');
    this.logger.debug(
      `[CREATE_DEAL] Payload: ${JSON.stringify({
        title: dto.title,
        value: dto.value,
        stage: dto.stage,
        ownerIds: dto.ownerIds,
        primaryOwnerId: dto.primaryOwnerId,
      })}`,
    );

    try {
      const input: CreateDealInput = {
        ...dto,
        organizationId,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : undefined,
      };

      const actorId = parseInt(req.user.id, 10);
      const result = await this.dealsService.create(input, actorId);
      this.logger.log(`[CREATE_DEAL] Success - Deal ID: ${result.id}`);
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`[CREATE_DEAL] Failed: ${errorMessage}`, errorStack);
      throw error;
    }
  }

  @Get()
  async list(
    @OrgId() organizationId: number,
    @Query() query: DealListQueryDto,
  ) {
    const filters = {
      organizationId,
      search: query.search,
      isHidden: query.isHidden === 'true',
      ownerIds: query.ownerIds
        ? query.ownerIds.split(',').map(Number)
        : undefined,
      companyIds: query.companyIds
        ? query.companyIds.split(',').map(Number)
        : undefined,
      contactIds: query.contactIds
        ? query.contactIds.split(',').map(Number)
        : undefined,
      stages: query.stages ? query.stages.split(',') : undefined,
      minValue: query.minValue ? Number(query.minValue) : undefined,
      maxValue: query.maxValue ? Number(query.maxValue) : undefined,
      expectedCloseFrom: query.expectedCloseFrom
        ? new Date(query.expectedCloseFrom)
        : undefined,
      expectedCloseTo: query.expectedCloseTo
        ? new Date(query.expectedCloseTo)
        : undefined,
    };

    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.dealsService.findAll(filters, pagination);
  }

  @Get(':id')
  async findOne(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dealsService.findById(id, organizationId);
  }

  @Patch(':id')
  async update(
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDealDto,
  ) {
    const input: UpdateDealInput = {
      ...dto,
      expectedCloseDate: dto.expectedCloseDate
        ? new Date(dto.expectedCloseDate)
        : undefined,
      actualCloseDate: dto.actualCloseDate
        ? new Date(dto.actualCloseDate)
        : undefined,
    };

    const actorId = parseInt(req.user.id, 10);
    return this.dealsService.update(id, organizationId, input, actorId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.dealsService.hide(id, organizationId);
  }

  @Post(':id/unhide')
  async unhide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dealsService.unhide(id, organizationId);
  }

  @Post(':id/owners')
  async addOwner(
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddOwnerDto,
  ) {
    const actorId = parseInt(req.user.id, 10);
    return this.dealsService.addOwner(
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
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    const actorId = parseInt(req.user.id, 10);
    await this.dealsService.removeOwner(id, organizationId, userId, actorId);
  }

  @Post(':id/owners/:userId/set-primary')
  async setPrimaryOwner(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.dealsService.setPrimaryOwner(id, organizationId, userId);
    return { success: true };
  }

  @Get('user/:userId')
  async getDealsByOwner(
    @OrgId() organizationId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: DealListQueryDto,
  ) {
    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.dealsService.getDealsByOwner(
      organizationId,
      userId,
      pagination,
    );
  }

  @Post(':id/companies')
  @HttpCode(HttpStatus.CREATED)
  async addCompany(
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddCompanyDto,
  ) {
    this.logger.log(
      `[ADD_COMPANY_TO_DEAL] Deal: ${id}, Company: ${dto.companyId}`,
    );

    try {
      const actorId = parseInt(req.user.id, 10);
      const result = await this.dealsService.addCompany(id, organizationId, dto, actorId);
      this.logger.log(
        `[ADD_COMPANY_TO_DEAL] Success - Company ${dto.companyId} added to Deal ${id}`,
      );
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[ADD_COMPANY_TO_DEAL] Failed: ${errorMessage}`,
        errorStack,
      );
      throw error;
    }
  }

  @Patch(':id/companies/:companyId')
  async updateCompany(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.dealsService.updateCompany(
      id,
      organizationId,
      companyId,
      dto.isPrimary,
    );
  }

  @Delete(':id/companies/:companyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCompany(
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('companyId', ParseIntPipe) companyId: number,
  ) {
    const actorId = parseInt(req.user.id, 10);
    await this.dealsService.removeCompany(id, organizationId, companyId, actorId);
  }

  @Get(':id/companies')
  async getCompanies(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dealsService.getCompanies(id, organizationId);
  }

  @Post(':id/contacts')
  @HttpCode(HttpStatus.CREATED)
  async addContact(
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddContactDto,
  ) {
    this.logger.log(
      `[ADD_CONTACT_TO_DEAL] Deal: ${id}, Contact: ${dto.contactId}`,
    );

    try {
      const actorId = parseInt(req.user.id, 10);
      const result = await this.dealsService.addContact(id, organizationId, dto, actorId);
      this.logger.log(
        `[ADD_CONTACT_TO_DEAL] Success - Contact ${dto.contactId} added to Deal ${id}`,
      );
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[ADD_CONTACT_TO_DEAL] Failed: ${errorMessage}`,
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
    return this.dealsService.updateContact(id, organizationId, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeContact(
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
  ) {
    const actorId = parseInt(req.user.id, 10);
    await this.dealsService.removeContact(id, organizationId, contactId, actorId);
  }

  @Get(':id/contacts')
  async getContacts(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dealsService.getContacts(id, organizationId);
  }

  @Get('company/:companyId')
  async getDealsByCompany(
    @OrgId() organizationId: number,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: DealListQueryDto,
  ) {
    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.dealsService.getDealsByCompany(
      organizationId,
      companyId,
      pagination,
    );
  }

  @Get('contact/:contactId')
  async getDealsByContact(
    @OrgId() organizationId: number,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Query() query: DealListQueryDto,
  ) {
    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.dealsService.getDealsByContact(
      organizationId,
      contactId,
      pagination,
    );
  }
}
