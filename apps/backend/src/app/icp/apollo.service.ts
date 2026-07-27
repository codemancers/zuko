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
  first_name: string;
  last_name_obfuscated: string;
  title: string | null;
  has_email: boolean;
  has_city: boolean;
  has_state: boolean;
  has_country: boolean;
  has_direct_phone: string;
  linkedin_url?: string;
  organization?: {
    name: string;
    has_industry: boolean;
    has_phone: boolean;
    has_city: boolean;
    has_state: boolean;
    has_country: boolean;
    has_zip_code: boolean;
    has_revenue: boolean;
    has_employee_count: boolean;
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
    if (filters.revenueRange?.min) {
      payload['revenue_range[min]'] = filters.revenueRange.min;
    }
    if (filters.revenueRange?.max) {
      payload['revenue_range[max]'] = filters.revenueRange.max;
    }
    if (filters.organizationName) {
      payload['q_organization_name'] = filters.organizationName;
    }
    if (filters.organizationIds?.length) {
      payload['organization_ids'] = filters.organizationIds;
    }
    if (filters.organizationDomains?.length) {
      payload['q_organization_domains_list'] = filters.organizationDomains;
    }
    if (filters.excludeLocations?.length) {
      payload['organization_not_locations'] = filters.excludeLocations;
    }
    if (filters.technologiesAnyOf?.length) {
      payload['currently_using_any_of_technology_uids'] =
        filters.technologiesAnyOf;
    }
    if (filters.technologiesAllOf?.length) {
      payload['currently_using_all_of_technology_uids'] =
        filters.technologiesAllOf;
    }
    if (filters.technologiesNoneOf?.length) {
      payload['currently_not_using_any_of_technology_uids'] =
        filters.technologiesNoneOf;
    }
    if (filters.latestFundingAmountRange?.min) {
      payload['latest_funding_amount_range[min]'] =
        filters.latestFundingAmountRange.min;
    }
    if (filters.latestFundingAmountRange?.max) {
      payload['latest_funding_amount_range[max]'] =
        filters.latestFundingAmountRange.max;
    }
    if (filters.totalFundingRange?.min) {
      payload['total_funding_range[min]'] = filters.totalFundingRange.min;
    }
    if (filters.totalFundingRange?.max) {
      payload['total_funding_range[max]'] = filters.totalFundingRange.max;
    }
    if (filters.latestFundingDateRange?.min) {
      payload['latest_funding_date_range[min]'] =
        filters.latestFundingDateRange.min;
    }
    if (filters.latestFundingDateRange?.max) {
      payload['latest_funding_date_range[max]'] =
        filters.latestFundingDateRange.max;
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

      const pagination = data.pagination ?? {};
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
          page: pagination.page ?? page,
          per_page: pagination.per_page ?? perPage,
          total_entries:
            pagination.total_entries ??
            pagination.total_organizations ??
            pagination.total_count ??
            0,
          total_pages: pagination.total_pages ?? 1,
        },
      };
    } catch (error) {
      this.handleError('searchCompanies', error);
    }
  }

  async searchContacts(
    organizationId: number,
    filters: IcpFiltersDto,
    page = 1,
    perPage = 25,
  ): Promise<ApolloContactsResult> {
    const payload: Record<string, unknown> = {
      page,
      per_page: perPage,
      sort_ascending: false,
    };

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
    if (filters.revenueRange?.min) {
      payload['revenue_range[min]'] = filters.revenueRange.min;
    }
    if (filters.revenueRange?.max) {
      payload['revenue_range[max]'] = filters.revenueRange.max;
    }
    if (filters.organizationName) {
      payload['q_organization_name'] = filters.organizationName;
    }
    if (filters.excludeLocations?.length) {
      payload['organization_not_locations'] = filters.excludeLocations;
    }
    if (filters.organizationIds?.length) {
      payload['organization_ids'] = filters.organizationIds;
    }
    if (filters.organizationDomains?.length) {
      payload['q_organization_domains_list'] = filters.organizationDomains;
    }
    if (filters.technologiesAnyOf?.length) {
      payload['currently_using_any_of_technology_uids'] =
        filters.technologiesAnyOf;
    }
    if (filters.technologiesAllOf?.length) {
      payload['currently_using_all_of_technology_uids'] =
        filters.technologiesAllOf;
    }
    if (filters.technologiesNoneOf?.length) {
      payload['currently_not_using_any_of_technology_uids'] =
        filters.technologiesNoneOf;
    }
    if (filters.latestFundingAmountRange?.min) {
      payload['latest_funding_amount_range[min]'] =
        filters.latestFundingAmountRange.min;
    }
    if (filters.latestFundingAmountRange?.max) {
      payload['latest_funding_amount_range[max]'] =
        filters.latestFundingAmountRange.max;
    }
    if (filters.totalFundingRange?.min) {
      payload['total_funding_range[min]'] = filters.totalFundingRange.min;
    }
    if (filters.totalFundingRange?.max) {
      payload['total_funding_range[max]'] = filters.totalFundingRange.max;
    }
    if (filters.latestFundingDateRange?.min) {
      payload['latest_funding_date_range[min]'] =
        filters.latestFundingDateRange.min;
    }
    if (filters.latestFundingDateRange?.max) {
      payload['latest_funding_date_range[max]'] =
        filters.latestFundingDateRange.max;
    }
    if (filters.personTitles?.length) {
      payload['person_titles'] = filters.personTitles;
    }
    if (filters.personSeniorities?.length) {
      payload['person_seniorities'] = filters.personSeniorities;
    }
    if (filters.includeSimilarTitles !== undefined) {
      payload['include_similar_titles'] = filters.includeSimilarTitles;
    }
    if (filters.personLocations?.length) {
      payload['person_locations'] = filters.personLocations;
    }
    if (filters.contactEmailStatus?.length) {
      payload['contact_email_status'] = filters.contactEmailStatus;
    }
    if (filters.keywords) {
      payload['q_keywords'] = filters.keywords;
    }

    this.logger.debug(`[APOLLO] searchContacts page=${page}`);

    try {
      const { data } = await axios.post<{
        total_entries?: number;
        people: Array<ApolloPerson>;
      }>(`${APOLLO_BASE}/mixed_people/api_search`, payload, {
        headers: await this.headers(organizationId),
      });

      const totalEntries = data.total_entries ?? 0;
      const totalPages = totalEntries ? Math.ceil(totalEntries / perPage) : 1;

      return {
        people: data.people ?? [],
        pagination: {
          page: Number(page),
          per_page: Number(perPage),
          total_entries: Number(totalEntries),
          total_pages: Number(totalPages),
        },
      };
    } catch (error) {
      this.handleError('searchContacts', error);
    }
  }
}
