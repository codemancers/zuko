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
  @ApiProperty({ example: 'Acme Corp' })
  companyName!: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  website?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/company/acme' })
  linkedinUrl?: string;

  @ApiPropertyOptional({
    type: Object,
    description: 'Rich-text summary (EditorJS format)',
  })
  summary?: EditorData;

  @ApiPropertyOptional({ type: [Number], example: [1, 2] })
  ownerIds?: number[];

  @ApiPropertyOptional({ type: Number, example: 1 })
  primaryOwnerId?: number;

  @ApiPropertyOptional({ type: Object, description: 'Custom field values' })
  fields?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: '5e66b6381e05b4008c8331b8',
    description: 'Apollo global organization ID (stable across workspaces)',
  })
  apolloOrganizationId?: string;

  @ApiPropertyOptional({
    example: '63f53afe4ceeca00016bdd2f',
    description: 'Apollo workspace account ID (exists once saved to Apollo)',
  })
  apolloAccountId?: string;
}

export class UpdateCompanyDto implements Partial<UpdateCompanyInput> {
  @ApiPropertyOptional({ example: 'Acme Corp' })
  companyName?: string;

  @ApiPropertyOptional({ example: 'https://acme.com' })
  website?: string;

  @ApiPropertyOptional()
  linkedinUrl?: string;

  @ApiPropertyOptional({ type: Object })
  summary?: EditorData;

  @ApiPropertyOptional({ type: Boolean })
  isHidden?: boolean;

  @ApiPropertyOptional({ type: Object })
  fields?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Apollo global organization ID (stable across workspaces)',
  })
  apolloOrganizationId?: string;

  @ApiPropertyOptional({
    description: 'Apollo workspace account ID (exists once saved to Apollo)',
  })
  apolloAccountId?: string;
}

export class CompanyListQueryDto {
  @ApiPropertyOptional({ type: Number, example: 1 })
  page?: number;

  @ApiPropertyOptional({ type: Number, example: 50 })
  limit?: number;

  @ApiPropertyOptional({ type: String, example: 'acme' })
  search?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Comma-separated owner user IDs',
    example: '1,2,3',
  })
  ownerIds?: string;

  @ApiPropertyOptional({
    type: String,
    enum: ['true', 'false'],
    example: 'false',
  })
  isHidden?: string;
}

export class AddOwnerDto {
  @ApiProperty({ type: Number, example: 1 })
  userId!: number;

  @ApiPropertyOptional({ type: Boolean })
  isPrimary?: boolean;
}

export class AddContactDto implements AddContactToCompanyInput {
  @ApiProperty({ type: Number, example: 5 })
  contactId!: number;

  @ApiPropertyOptional({ example: 'CTO' })
  role?: string;

  @ApiPropertyOptional({ type: Boolean })
  isPrimary?: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  joinedAt?: Date;
}

export class UpdateContactDto implements UpdateContactCompanyInput {
  @ApiPropertyOptional({ example: 'CTO' })
  role?: string;

  @ApiPropertyOptional({ type: Boolean })
  isPrimary?: boolean;
}

@ApiTags('Companies')
@ApiBearerAuth('session')
@Controller('companies')
@UseGuards(AuthGuard, OrganizationGuard)
export class CompaniesController {
  private readonly logger = new Logger(CompaniesController.name);

  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new company' })
  @ApiResponse({ status: 201, description: 'Company created' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
  @ApiOperation({ summary: 'List companies with optional filters' })
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
  @ApiResponse({ status: 200, description: 'Paginated company list' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
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
  @ApiOperation({ summary: 'Get a company by ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Company details' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async findOne(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.companiesService.findById(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a company' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Updated company' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 404, description: 'Company not found' })
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
  @ApiOperation({ summary: 'Hide (soft-delete) a company' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 204, description: 'Company hidden' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async hide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.companiesService.hide(id, organizationId);
  }

  @Post(':id/unhide')
  @ApiOperation({ summary: 'Restore a hidden company' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Company restored' })
  async unhide(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.companiesService.unhide(id, organizationId);
  }

  @Post(':id/owners')
  @ApiOperation({ summary: 'Add an owner to a company' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Owner added' })
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
  @ApiOperation({ summary: 'Remove an owner from a company' })
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
    await this.companiesService.removeOwner(
      id,
      organizationId,
      userId,
      actorId,
    );
  }

  @Post(':id/owners/:userId/set-primary')
  @ApiOperation({ summary: 'Set a primary owner for a company' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 200, description: 'Primary owner set' })
  async setPrimaryOwner(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.companiesService.setPrimaryOwner(id, organizationId, userId);
    return { success: true };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'List companies owned by a specific user' })
  @ApiParam({ name: 'userId', type: Number })
  @ApiResponse({ status: 200, description: 'Company list' })
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
  @ApiOperation({ summary: 'Add a contact to a company' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 201, description: 'Contact added' })
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
  @ApiOperation({ summary: 'Update contact relationship with a company' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'contactId', type: Number })
  @ApiResponse({ status: 200, description: 'Contact relationship updated' })
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
  @ApiOperation({ summary: 'Remove a contact from a company' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'contactId', type: Number })
  @ApiResponse({ status: 204, description: 'Contact removed' })
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
  @ApiOperation({ summary: 'Get active contacts for a company' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Active contacts list' })
  async getActiveContacts(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.companiesService.getActiveContacts(id, organizationId);
  }

  @Get(':id/contacts/history')
  @ApiOperation({ summary: 'Get contact history for a company' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Contact history' })
  async getContactHistory(
    @OrgId() organizationId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.companiesService.getContactHistory(id, organizationId);
  }
}
