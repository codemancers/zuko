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
  DealsService,
  CreateDealInput,
  UpdateDealInput,
  AddCompanyToDealInput,
  AddContactToDealInput,
  UpdateContactDealInput,
} from '@zuko/sales';

// DTOs for API requests
export class CreateDealDto implements CreateDealInput {
  title!: string;
  value?: number;
  currency?: string;
  probability?: number;
  stage?: string;
  summary?: string;
  expectedCloseDate?: Date;
  source?: string;
  priority?: number;
  ownerIds!: number[];
  primaryOwnerId?: number;
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
@UseGuards(AuthGuard)
export class DealsController {
  private readonly logger = new Logger(DealsController.name);

  constructor(private readonly dealsService: DealsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDealDto) {
    this.logger.log('[CREATE_DEAL] Request received');
    this.logger.debug(
      `[CREATE_DEAL] Payload: ${JSON.stringify({
        title: dto.title,
        value: dto.value,
        stage: dto.stage,
        ownerIds: dto.ownerIds,
        primaryOwnerId: dto.primaryOwnerId,
      })}`
    );

    try {
      // Transform expectedCloseDate string to Date object if provided
      const input: CreateDealInput = {
        ...dto,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : undefined,
      };

      const result = await this.dealsService.create(input);
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
  async list(@Query() query: DealListQueryDto) {
    const filters = {
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
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.dealsService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDealDto
  ) {
    // Transform date strings to Date objects if provided
    const input: UpdateDealInput = {
      ...dto,
      expectedCloseDate: dto.expectedCloseDate
        ? new Date(dto.expectedCloseDate)
        : undefined,
      actualCloseDate: dto.actualCloseDate
        ? new Date(dto.actualCloseDate)
        : undefined,
    };

    return this.dealsService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hide(@Param('id', ParseIntPipe) id: number) {
    await this.dealsService.hide(id);
  }

  @Post(':id/unhide')
  async unhide(@Param('id', ParseIntPipe) id: number) {
    return this.dealsService.unhide(id);
  }

  @Post(':id/owners')
  async addOwner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddOwnerDto
  ) {
    return this.dealsService.addOwner(id, dto.userId, dto.isPrimary);
  }

  @Delete(':id/owners/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOwner(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number
  ) {
    await this.dealsService.removeOwner(id, userId);
  }

  @Post(':id/owners/:userId/set-primary')
  async setPrimaryOwner(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number
  ) {
    await this.dealsService.setPrimaryOwner(id, userId);
    return { success: true };
  }

  @Get('user/:userId')
  async getDealsByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: DealListQueryDto
  ) {
    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.dealsService.getDealsByUser(userId, pagination);
  }

  @Post(':id/companies')
  @HttpCode(HttpStatus.CREATED)
  async addCompany(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddCompanyDto
  ) {
    this.logger.log(
      `[ADD_COMPANY_TO_DEAL] Deal: ${id}, Company: ${dto.companyId}`
    );

    try {
      const result = await this.dealsService.addCompany(id, dto);
      this.logger.log(
        `[ADD_COMPANY_TO_DEAL] Success - Company ${dto.companyId} added to Deal ${id}`
      );
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[ADD_COMPANY_TO_DEAL] Failed: ${errorMessage}`,
        errorStack
      );
      throw error;
    }
  }

  @Patch(':id/companies/:companyId')
  async updateCompany(
    @Param('id', ParseIntPipe) id: number,
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() dto: UpdateCompanyDto
  ) {
    return this.dealsService.updateCompany(id, companyId, dto.isPrimary);
  }

  @Delete(':id/companies/:companyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCompany(
    @Param('id', ParseIntPipe) id: number,
    @Param('companyId', ParseIntPipe) companyId: number
  ) {
    await this.dealsService.removeCompany(id, companyId);
  }

  @Get(':id/companies')
  async getCompanies(@Param('id', ParseIntPipe) id: number) {
    return this.dealsService.getCompanies(id);
  }

  @Post(':id/contacts')
  @HttpCode(HttpStatus.CREATED)
  async addContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddContactDto
  ) {
    this.logger.log(
      `[ADD_CONTACT_TO_DEAL] Deal: ${id}, Contact: ${dto.contactId}`
    );

    try {
      const result = await this.dealsService.addContact(id, dto);
      this.logger.log(
        `[ADD_CONTACT_TO_DEAL] Success - Contact ${dto.contactId} added to Deal ${id}`
      );
      return result;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `[ADD_CONTACT_TO_DEAL] Failed: ${errorMessage}`,
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
    return this.dealsService.updateContact(id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeContact(
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number
  ) {
    await this.dealsService.removeContact(id, contactId);
  }

  @Get(':id/contacts')
  async getContacts(@Param('id', ParseIntPipe) id: number) {
    return this.dealsService.getContacts(id);
  }

  @Get('company/:companyId')
  async getDealsByCompany(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Query() query: DealListQueryDto
  ) {
    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.dealsService.getDealsByCompany(companyId, pagination);
  }

  @Get('contact/:contactId')
  async getDealsByContact(
    @Param('contactId', ParseIntPipe) contactId: number,
    @Query() query: DealListQueryDto
  ) {
    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.dealsService.getDealsByContact(contactId, pagination);
  }
}
