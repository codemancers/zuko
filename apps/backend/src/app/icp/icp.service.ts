import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApolloService } from './apollo.service';
import { IcpLlmService } from './icp-llm.service';
import { IcpRepository } from './icp.repository';
import type {
  CreateIcpProfileDto,
  IcpFiltersDto,
  UpdateIcpProfileDto,
} from './dto/icp.dto';

@Injectable()
export class IcpService {
  private readonly logger = new Logger(IcpService.name);

  constructor(
    private readonly icpRepository: IcpRepository,
    private readonly apolloService: ApolloService,
    private readonly llmService: IcpLlmService,
  ) {}

  classifyIntent(message: string): Promise<{ intent: 'confirm' | 'refine' }> {
    return this.llmService.classifyIntent(message);
  }

  refineFilters(currentFilters: IcpFiltersDto, message: string) {
    return this.llmService.refineFilters(currentFilters, message);
  }

  create(organizationId: number, dto: CreateIcpProfileDto) {
    return this.icpRepository.create(organizationId, dto);
  }

  findAll(organizationId: number, page = 1, perPage = 20) {
    return this.icpRepository.findAll(organizationId, page, perPage);
  }

  async findById(id: number, organizationId: number) {
    const profile = await this.icpRepository.findById(id, organizationId);
    if (!profile) {
      throw new NotFoundException(`ICP profile ${id} not found`);
    }
    return profile;
  }

  async update(id: number, organizationId: number, dto: UpdateIcpProfileDto) {
    await this.findById(id, organizationId);
    return this.icpRepository.update(id, dto);
  }

  async delete(id: number, organizationId: number) {
    await this.findById(id, organizationId);
    return this.icpRepository.delete(id);
  }

  async getApolloCompanies(
    id: number,
    organizationId: number,
    page: number,
    perPage: number,
  ) {
    const profile = await this.findById(id, organizationId);
    const filters = (profile.filters ?? {}) as IcpFiltersDto;
    this.logger.debug(`[ICP] Fetching live Apollo companies for profile ${id}`);
    return this.apolloService.searchCompanies(
      organizationId,
      filters,
      page,
      perPage,
    );
  }

  async previewFiltersAnon(organizationId: number, filters: IcpFiltersDto) {
    this.logger.debug('[ICP] Previewing filters (no profile)');
    return this.runPreview(organizationId, filters);
  }

  async previewFilters(
    id: number,
    organizationId: number,
    filters: IcpFiltersDto,
  ) {
    await this.findById(id, organizationId);
    this.logger.debug(`[ICP] Previewing filters for profile ${id}`);
    return this.runPreview(organizationId, filters);
  }

  private async runPreview(organizationId: number, filters: IcpFiltersDto) {
    const contacts = await this.apolloService
      .searchContacts(organizationId, filters, 1, 1)
      .catch(() => null);
    const contactsCount = contacts?.pagination.total_entries ?? null;
    const filterBreadth =
      contactsCount === null
        ? null
        : contactsCount > 5000
          ? 'broad'
          : contactsCount > 1000
            ? 'warn'
            : 'ok';
    return { companiesCount: null, contactsCount, filterBreadth };
  }

  async getApolloContacts(
    id: number,
    organizationId: number,
    page: number,
    perPage: number,
  ) {
    const profile = await this.findById(id, organizationId);
    const filters = (profile.filters ?? {}) as IcpFiltersDto;
    this.logger.debug(`[ICP] Fetching live Apollo contacts for profile ${id}`);
    return this.apolloService.searchContacts(
      organizationId,
      filters,
      page,
      perPage,
    );
  }
}
