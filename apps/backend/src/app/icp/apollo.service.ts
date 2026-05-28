import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import axios, { type AxiosError } from 'axios';
import { ApolloIntegrationService } from '../integrations/apollo/apollo-integration.service';
import type { IcpFiltersDto } from './dto/icp.dto';

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

export interface ApolloOrganization {
  id: string;
  name: string;
  website_url?: string;
  linkedin_url?: string;
  industry?: string;
  estimated_num_employees?: number;
  annual_revenue?: number;
  primary_domain?: string;
  city?: string;
  state?: string;
  country?: string;
  logo_url?: string;
  total_funding?: number;
  latest_funding_amount?: number;
}

export interface ApolloPerson {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
  photo_url?: string;
  organization?: {
    name?: string;
    website_url?: string;
    primary_domain?: string;
  };
}

export interface ApolloPagination {
  page: number;
  per_page: number;
  total_entries: number;
  total_pages: number;
}

export interface ApolloCompaniesResult {
  organizations: ApolloOrganization[];
  pagination: ApolloPagination;
}

export interface ApolloContactsResult {
  people: ApolloPerson[];
  pagination: ApolloPagination;
}

@Injectable()
export class ApolloService {
  private readonly logger = new Logger(ApolloService.name);

  constructor(
    private readonly apolloIntegrationService: ApolloIntegrationService,
  ) {}

  private async headers(organizationId: number) {
    const accessToken =
      await this.apolloIntegrationService.getAccessToken(organizationId);
    return {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  private handleError(context: string, error: unknown): never {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    const responseData = axiosError.response?.data as
      | Record<string, string>
      | undefined;
    this.logger.error(
      `[APOLLO] ${context} failed: ${status} — ${JSON.stringify(responseData)}`,
    );
    const message =
      responseData?.['error'] ??
      responseData?.['message'] ??
      axiosError.message;
    if (status === 403) {
      throw new ForbiddenException(message || 'Apollo API access denied.');
    }
    throw new BadGatewayException(`Apollo API error (${status}): ${message}`);
  }

  async searchCompanies(
    organizationId: number,
    filters: IcpFiltersDto,
    page = 1,
    perPage = 25,
  ): Promise<ApolloCompaniesResult> {
    const payload: Record<string, unknown> = { page, per_page: perPage };

    if (filters.industries?.length) {
      payload['q_organization_keyword_tags'] = filters.industries;
    }
    if (filters.employeeRanges?.length) {
      const normalized: string[] = [];
      const raw = filters.employeeRanges;
      for (let i = 0; i < raw.length; i++) {
        if (raw[i].includes(',')) {
          normalized.push(raw[i]);
        } else if (i + 1 < raw.length && !raw[i + 1].includes(',')) {
          normalized.push(`${raw[i]},${raw[i + 1]}`);
          i++;
        }
      }
      if (normalized.length)
        payload['organization_num_employees_ranges'] = normalized;
    }
    if (filters.locations?.length) {
      payload['organization_locations'] = filters.locations;
    }

    this.logger.debug(`[APOLLO] searchCompanies page=${page}`);

    try {
      const { data } = await axios.post<{
        organizations: Array<{
          id: string;
          name: string;
          website_url?: string;
          linkedin_url?: string;
          industry?: string;
          estimated_num_employees?: number;
          annual_revenue?: number;
          primary_domain?: string;
          city?: string;
          state?: string;
          country?: string;
          logo_url?: string;
          total_funding?: number;
          latest_funding_amount?: number;
        }>;
        pagination: Record<string, number>;
      }>(`${APOLLO_BASE}/organizations/search`, payload, {
        headers: await this.headers(organizationId),
      });

      const pag = data.pagination ?? {};
      return {
        organizations: (data.organizations ?? []).map((o) => ({
          id: o.id,
          name: o.name,
          website_url: o.website_url,
          linkedin_url: o.linkedin_url,
          industry: o.industry,
          estimated_num_employees: o.estimated_num_employees,
          annual_revenue: o.annual_revenue,
          primary_domain: o.primary_domain,
          city: o.city,
          state: o.state,
          country: o.country,
          logo_url: o.logo_url,
          total_funding: o.total_funding,
          latest_funding_amount: o.latest_funding_amount,
        })),
        pagination: {
          page: pag['page'] ?? page,
          per_page: pag['per_page'] ?? perPage,
          total_entries:
            pag['total_entries'] ??
            pag['total_organizations'] ??
            pag['total_count'] ??
            0,
          total_pages: pag['total_pages'] ?? 1,
        },
      };
    } catch (error) {
      this.handleError('searchCompanies', error);
    }
  }

  async searchContacts(
    organizationId: number,
    _filters: IcpFiltersDto,
    page = 1,
    perPage = 25,
  ): Promise<ApolloContactsResult> {
    const payload: Record<string, unknown> = {
      page,
      per_page: perPage,
      sort_ascending: false,
    };

    this.logger.debug(`[APOLLO] searchContacts page=${page}`);

    try {
      const { data } = await axios.post<{
        contacts: Array<{
          id: string;
          name: string;
          first_name?: string;
          last_name?: string;
          title?: string;
          linkedin_url?: string | null;
          photo_url?: string | null;
          present_raw_address?: string | null;
          organization_name?: string;
          organization?: {
            id?: string;
            name?: string;
            website_url?: string;
            linkedin_url?: string;
            logo_url?: string;
            primary_domain?: string;
          };
        }>;
        pagination: {
          page: number;
          per_page: number;
          total_entries: number;
          total_pages: number;
        };
      }>(`${APOLLO_BASE}/contacts/search`, payload, {
        headers: await this.headers(organizationId),
      });

      const pag = data.pagination ?? {};
      return {
        people: (data.contacts ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          first_name: c.first_name,
          last_name: c.last_name,
          title: c.title,
          linkedin_url: c.linkedin_url ?? undefined,
          photo_url: c.photo_url ?? undefined,
          city: c.present_raw_address ?? undefined,
          organization: c.organization
            ? {
                name: c.organization.name,
                website_url: c.organization.website_url,
                primary_domain: c.organization.primary_domain,
              }
            : c.organization_name
              ? { name: c.organization_name }
              : undefined,
        })),
        pagination: {
          page: pag['page'] ?? page,
          per_page: pag['per_page'] ?? perPage,
          total_entries: pag['total_entries'] ?? 0,
          total_pages: pag['total_pages'] ?? 1,
        },
      };
    } catch (error) {
      this.handleError('searchContacts', error);
    }
  }
}
