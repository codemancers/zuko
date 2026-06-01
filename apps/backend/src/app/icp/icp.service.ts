import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
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

  private cachedCountries: { label: string; value: string }[] | null = null;

  async getCountries(): Promise<{ label: string; value: string }[]> {
    if (this.cachedCountries) return this.cachedCountries;

    try {
      const { data } = await axios.get<{ name: { common: string } }[]>(
        'https://restcountries.com/v3.1/all',
        { params: { fields: 'name' } },
      );
      this.cachedCountries = data
        .map((c) => ({ label: c.name.common, value: c.name.common }))
        .sort((a, b) => a.label.localeCompare(b.label));
      return this.cachedCountries;
    } catch (error) {
      this.logger.error('[ICP] Failed to fetch countries', error);
      throw new BadGatewayException('Failed to fetch countries');
    }
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
    this.logger.debug(`[ICP] Fetching Apollo companies for profile ${id}`);
    return this.apolloService.searchCompanies(
      organizationId,
      filters,
      page,
      perPage,
    );
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
    return this.apolloService.searchContacts(
      organizationId,
      filters,
      page,
      perPage,
    );
  }
}
