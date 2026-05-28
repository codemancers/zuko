import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApolloService } from './apollo.service';
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
  ) {}

  create(organizationId: number, dto: CreateIcpProfileDto) {
    return this.icpRepository.create(organizationId, dto);
  }

  findAll(organizationId: number) {
    return this.icpRepository.findAll(organizationId);
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
    this.logger.debug(`[ICP] Fetching Apollo companies for profile ${id}`);
    return this.apolloService.searchCompanies(filters, page, perPage);
  }

  async getApolloContacts(
    id: number,
    organizationId: number,
    page: number,
    perPage: number,
  ) {
    const profile = await this.findById(id, organizationId);
    const filters = (profile.filters ?? {}) as IcpFiltersDto;
    this.logger.debug(`[ICP] Fetching Apollo contacts for profile ${id}`);
    return this.apolloService.searchContacts(filters, page, perPage);
  }
}
