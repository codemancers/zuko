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
import { DealsService } from '@zuko/sales';
import type {
  CreateDealInput,
  UpdateDealInput,
  AddCompanyToDealInput,
  AddContactToDealInput,
  UpdateContactDealInput,
  EditorData,
} from '@zuko/sales';
import type { RequestWithUser } from '@zuko/core';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { OrgId } from '../../common/auth/org-id.decorator';

// DTOs for API requests (organizationId is set from session via OrganizationGuard)
export class CreateDealDto implements Omit<CreateDealInput, 'organizationId'> {
  @ApiProperty({ example: 'Enterprise License Deal' })
  title!: string;

  @ApiPropertyOptional({ type: Number, example: 50000 })
  value?: number;

  @ApiPropertyOptional({ example: 'USD' })
  currency?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 75,
    description: 'Win probability 0-100',
  })
  probability?: number;

  @ApiPropertyOptional({ example: 'proposal' })
  stage?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Rich-text summary (EditorJS format)',
  })
  summary?: EditorData;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  expectedCloseDate?: Date;

  @ApiPropertyOptional({ example: 'inbound' })
  source?: string;

  @ApiPropertyOptional({ type: Number, example: 2 })
  priority?: number;

  @ApiPropertyOptional({ type: [Number], example: [1, 2] })
  ownerIds?: number[];

  @ApiPropertyOptional({ type: Number, example: 1 })
  primaryOwnerId?: number;

  @ApiPropertyOptional({ type: Object })
  fields?: Record<string, unknown>;
}

export class UpdateDealDto implements Partial<UpdateDealInput> {
  @ApiPropertyOptional({ example: 'Enterprise License Deal' })
  title?: string;

  @ApiPropertyOptional({ type: Number })
  value?: number;

  @ApiPropertyOptional()
  currency?: string;

  @ApiPropertyOptional({ type: Number })
  probability?: number;

  @ApiPropertyOptional()
  stage?: string;

  @ApiPropertyOptional({ type: Object })
  summary?: EditorData;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  expectedCloseDate?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  actualCloseDate?: Date;

  @ApiPropertyOptional()
  lostReason?: string;

  @ApiPropertyOptional()
  source?: string;

  @ApiPropertyOptional({ type: Number })
  priority?: number;

  @ApiPropertyOptional({ type: Object })
  fields?: Record<string, unknown>;
}

export class DealListQueryDto {
  @ApiPropertyOptional({ type: Number, example: 1 })
  page?: number;

  @ApiPropertyOptional({ type: Number, example: 50 })
  limit?: number;

  @ApiPropertyOptional({ type: String })
  search?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated owner user IDs',
    example: '1,2',
  })
  ownerIds?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated company IDs',
    example: '3,4',
  })
  companyIds?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated contact IDs',
  })
  contactIds?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated stage names',
    example: 'proposal,won',
  })
  stages?: string;

  @ApiPropertyOptional({ type: Number })
  minValue?: number;

  @ApiPropertyOptional({ type: Number })
  maxValue?: number;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-01-01' })
  expectedCloseFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-12-31' })
  expectedCloseTo?: string;

  @ApiPropertyOptional({ type: String, enum: ['true', 'false'] })
  isHidden?: string;
}

export class AddOwnerDto {
  @ApiProperty({ type: Number, example: 1 })
  userId!: number;

  @ApiPropertyOptional({ type: Boolean })
  isPrimary?: boolean;
}

export class AddCompanyDto implements AddCompanyToDealInput {
  @ApiProperty({ type: Number, example: 3 })
  companyId!: number;

  @ApiPropertyOptional({ type: Boolean })
  isPrimary?: boolean;
}

export class UpdateCompanyDto {
  @ApiProperty({ type: Boolean })
  isPrimary!: boolean;
}

export class AddContactDto implements AddContactToDealInput {
  @ApiProperty({ type: Number, example: 5 })
  contactId!: number;

  @ApiPropertyOptional({ example: 'Decision Maker' })
  role?: string;

  @ApiPropertyOptional({ type: Boolean })
  isPrimary?: boolean;
}

export class UpdateContactDto implements UpdateContactDealInput {
  @ApiPropertyOptional()
  role?: string;

  @ApiPropertyOptional({ type: Boolean })
  isPrimary?: boolean;
}

@ApiTags('Deals')
@ApiBearerAuth('session')
@Controller('deals')
@UseGuards(AuthGuard, OrganizationGuard)
export class DealsController {
  private readonly logger = new Logger(DealsController.name);

  constructor(private readonly dealsService: DealsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new deal' })
  @ApiResponse({ status: 201, description: 'Deal created' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async create(
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
    @Body() dto: CreateDealDto,
  ) {
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
  @ApiOperation({ summary: 'List deals with optional filters' })
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
    name: 'companyIds',
    required: false,
    type: String,
    description: 'Comma-separated company IDs',
  })
  @ApiQuery({
    name: 'contactIds',
    required: false,
    type: String,
    description: 'Comma-separated contact IDs',
  })
  @ApiQuery({
    name: 'stages',
    required: false,
    type: String,
    description: 'Comma-separated stage names',
  })
  @ApiQuery({ name: 'minValue', required: false, type: Number })
  @ApiQuery({ name: 'maxValue', required: false, type: Number })
  @ApiQuery({ name: 'expectedCloseFrom', required: false, type: String })
  @ApiQuery({ name: 'expectedCloseTo', required: false, type: String })
  @ApiQuery({
    name: 'isHidden',
    required: false,
    type: String,
    enum: ['true', 'false'],
  })
  @ApiResponse({ status: 200, description: 'Paginated deal list' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
  @ApiOperation({ summary: 'Get a deal by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Deal details' })
  @ApiResponse({ status: 404, description: 'Deal not found' })
  async findOne(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dealsService.findById(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Updated deal' })
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
  @ApiOperation({ summary: 'Hide (soft-delete) a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Deal hidden' })
  async hide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.dealsService.hide(id, organizationId);
  }

  @Post(':id/unhide')
  @ApiOperation({ summary: 'Restore a hidden deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Deal restored' })
  async unhide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dealsService.unhide(id, organizationId);
  }

  @Post(':id/owners')
  @ApiOperation({ summary: 'Add an owner to a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Owner added' })
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
  @ApiOperation({ summary: 'Remove an owner from a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 204, description: 'Owner removed' })
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
  @ApiOperation({ summary: 'Set a primary owner for a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 200, description: 'Primary owner set' })
  async setPrimaryOwner(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.dealsService.setPrimaryOwner(id, organizationId, userId);
    return { success: true };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'List deals owned by a specific user' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 200, description: 'Deal list' })
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
  @ApiOperation({ summary: 'Add a company to a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Company added' })
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
      const result = await this.dealsService.addCompany(
        id,
        organizationId,
        dto,
        actorId,
      );
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
  @ApiOperation({ summary: 'Update company relationship with a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'companyId', type: Number })
  @ApiResponse({ status: 200, description: 'Company relationship updated' })
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
  @ApiOperation({ summary: 'Remove a company from a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'companyId', type: Number })
  @ApiResponse({ status: 204, description: 'Company removed' })
  async removeCompany(
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('companyId', ParseIntPipe) companyId: number,
  ) {
    const actorId = parseInt(req.user.id, 10);
    await this.dealsService.removeCompany(
      id,
      organizationId,
      companyId,
      actorId,
    );
  }

  @Get(':id/companies')
  @ApiOperation({ summary: 'Get companies linked to a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Company list' })
  async getCompanies(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dealsService.getCompanies(id, organizationId);
  }

  @Post(':id/contacts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a contact to a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Contact added' })
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
      const result = await this.dealsService.addContact(
        id,
        organizationId,
        dto,
        actorId,
      );
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
  @ApiOperation({ summary: 'Update contact relationship with a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'contactId', type: Number })
  @ApiResponse({ status: 200, description: 'Contact relationship updated' })
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
  @ApiOperation({ summary: 'Remove a contact from a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'contactId', type: Number })
  @ApiResponse({ status: 204, description: 'Contact removed' })
  async removeContact(
    @Req() req: RequestWithUser,
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
  ) {
    const actorId = parseInt(req.user.id, 10);
    await this.dealsService.removeContact(
      id,
      organizationId,
      contactId,
      actorId,
    );
  }

  @Get(':id/contacts')
  @ApiOperation({ summary: 'Get contacts linked to a deal' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Contact list' })
  async getContacts(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.dealsService.getContacts(id, organizationId);
  }

  @Get('company/:companyId')
  @ApiOperation({ summary: 'List deals for a specific company' })
  @ApiParam({ name: 'companyId', type: Number })
  @ApiResponse({ status: 200, description: 'Deal list' })
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
  @ApiOperation({ summary: 'List deals for a specific contact' })
  @ApiParam({ name: 'contactId', type: Number })
  @ApiResponse({ status: 200, description: 'Deal list' })
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
