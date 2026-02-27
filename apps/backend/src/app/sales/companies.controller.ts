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
  CompaniesService,
  CreateCompanyInput,
  UpdateCompanyInput,
  AddContactToCompanyInput,
  UpdateContactCompanyInput,
} from '@zuko/sales';

// DTOs for API requests (properties set by Nest from request body)
export class CreateCompanyDto implements CreateCompanyInput {
  companyName!: string;
  website?: string;
  linkedinUrl?: string;
  summary?: string;
  ownerIds!: number[];
  primaryOwnerId?: number;
}

export class UpdateCompanyDto implements Partial<UpdateCompanyInput> {
  companyName?: string;
  website?: string;
  linkedinUrl?: string;
  summary?: string;
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
@UseGuards(AuthGuard)
export class CompaniesController {
  private readonly logger = new Logger(CompaniesController.name);

  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCompanyDto) {
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
      const result = await this.companiesService.create(dto);
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
  async list(@Query() query: CompanyListQueryDto) {
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

    return this.companiesService.findAll(filters, pagination);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async hide(@Param('id', ParseIntPipe) id: number) {
    await this.companiesService.hide(id);
  }

  @Post(':id/unhide')
  async unhide(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.unhide(id);
  }

  @Post(':id/owners')
  async addOwner(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddOwnerDto,
  ) {
    return this.companiesService.addOwner(id, dto.userId, dto.isPrimary);
  }

  @Delete(':id/owners/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOwner(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.companiesService.removeOwner(id, userId);
  }

  @Post(':id/owners/:userId/set-primary')
  async setPrimaryOwner(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    await this.companiesService.setPrimaryOwner(id, userId);
    return { success: true };
  }

  @Get('user/:userId')
  async getCompaniesByUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: CompanyListQueryDto,
  ) {
    const pagination = {
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 50,
    };

    return this.companiesService.getCompaniesByUser(userId, pagination);
  }

  @Post(':id/contacts')
  @HttpCode(HttpStatus.CREATED)
  async addContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddContactDto,
  ) {
    this.logger.log(
      `[ADD_CONTACT_TO_COMPANY] Company: ${id}, Contact: ${dto.contactId}`,
    );

    try {
      const result = await this.companiesService.addContact(id, dto);
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
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
    @Body() dto: UpdateContactDto,
  ) {
    return this.companiesService.updateContactCompany(id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeContact(
    @Param('id', ParseIntPipe) id: number,
    @Param('contactId', ParseIntPipe) contactId: number,
  ) {
    await this.companiesService.removeContact(id, contactId);
  }

  @Get(':id/contacts')
  async getActiveContacts(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.getActiveContacts(id);
  }

  @Get(':id/contacts/history')
  async getContactHistory(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.getContactHistory(id);
  }
}
