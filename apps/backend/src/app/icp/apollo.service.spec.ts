import { Test, TestingModule } from '@nestjs/testing';
import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import axios from 'axios';
import { ApolloService } from './apollo.service';
import { ApolloIntegrationService } from '../integrations/apollo/apollo-integration.service';
import type { IcpFiltersDto } from './dto/icp.dto';

vi.mock('axios');

const mockApolloIntegrationService = {
  getAccessToken: vi.fn().mockResolvedValue('test-token'),
};

function makeOrgResponse(orgs: unknown[] = []) {
  return {
    data: {
      organizations: orgs,
      pagination: {
        page: 1,
        per_page: 25,
        total_entries: orgs.length,
        total_pages: 1,
      },
    },
  };
}

function makePeopleResponse(people: unknown[] = [], totalEntries = 0) {
  return { data: { people, total_entries: totalEntries } };
}

describe('ApolloService', () => {
  let service: ApolloService;
  let axiosPost: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApolloService,
        {
          provide: ApolloIntegrationService,
          useValue: mockApolloIntegrationService,
        },
      ],
    }).compile();

    service = module.get<ApolloService>(ApolloService);
    axiosPost = vi.spyOn(axios, 'post');
    vi.clearAllMocks();
    mockApolloIntegrationService.getAccessToken.mockResolvedValue('test-token');
  });

  // ── searchCompanies ────────────────────────────────────────────────────────

  describe('searchCompanies', () => {
    it('sends base pagination params', async () => {
      axiosPost.mockResolvedValue(makeOrgResponse());
      await service.searchCompanies(1, {}, 2, 10);

      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;
      expect(payload['page']).toBe(2);
      expect(payload['per_page']).toBe(10);
    });

    it('maps existing 4 firmographic filters', async () => {
      axiosPost.mockResolvedValue(makeOrgResponse());
      const filters: IcpFiltersDto = {
        industries: ['saas'],
        employeeRanges: ['50,200'],
        locations: ['United States'],
        revenueRange: { min: 1000000, max: 50000000 },
      };

      await service.searchCompanies(1, filters);
      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;

      expect(payload['q_organization_keyword_tags']).toEqual(['saas']);
      expect(payload['organization_num_employees_ranges']).toEqual(['50,200']);
      expect(payload['organization_locations']).toEqual(['United States']);
      expect(payload['revenue_range[min]']).toBe(1000000);
      expect(payload['revenue_range[max]']).toBe(50000000);
    });

    it('maps technographic filters', async () => {
      axiosPost.mockResolvedValue(makeOrgResponse());
      const filters: IcpFiltersDto = {
        technologiesAnyOf: ['salesforce', 'hubspot'],
        technologiesAllOf: ['slack'],
        technologiesNoneOf: ['wordpress_org'],
      };

      await service.searchCompanies(1, filters);
      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;

      expect(payload['currently_using_any_of_technology_uids']).toEqual([
        'salesforce',
        'hubspot',
      ]);
      expect(payload['currently_using_all_of_technology_uids']).toEqual([
        'slack',
      ]);
      expect(payload['currently_not_using_any_of_technology_uids']).toEqual([
        'wordpress_org',
      ]);
    });

    it('maps funding filters', async () => {
      axiosPost.mockResolvedValue(makeOrgResponse());
      const filters: IcpFiltersDto = {
        latestFundingAmountRange: { min: 5000000, max: 15000000 },
        totalFundingRange: { min: 50000000, max: 350000000 },
        latestFundingDateRange: { min: '2024-01-01', max: '2025-12-31' },
      };

      await service.searchCompanies(1, filters);
      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;

      expect(payload['latest_funding_amount_range[min]']).toBe(5000000);
      expect(payload['latest_funding_amount_range[max]']).toBe(15000000);
      expect(payload['total_funding_range[min]']).toBe(50000000);
      expect(payload['total_funding_range[max]']).toBe(350000000);
      expect(payload['latest_funding_date_range[min]']).toBe('2024-01-01');
      expect(payload['latest_funding_date_range[max]']).toBe('2025-12-31');
    });

    it('maps company identification filters', async () => {
      axiosPost.mockResolvedValue(makeOrgResponse());
      const filters: IcpFiltersDto = {
        organizationName: 'Apollo',
        organizationIds: ['5e66b6381e05b4008c8331b8'],
        organizationDomains: ['apollo.io'],
        excludeLocations: ['Russia'],
      };

      await service.searchCompanies(1, filters);
      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;

      expect(payload['q_organization_name']).toBe('Apollo');
      expect(payload['organization_ids']).toEqual(['5e66b6381e05b4008c8331b8']);
      expect(payload['q_organization_domains_list']).toEqual(['apollo.io']);
      expect(payload['organization_not_locations']).toEqual(['Russia']);
    });

    it('skips empty arrays — does not pollute Apollo payload', async () => {
      axiosPost.mockResolvedValue(makeOrgResponse());
      const filters: IcpFiltersDto = {
        technologiesAnyOf: [],
        organizationIds: [],
        excludeLocations: [],
      };

      await service.searchCompanies(1, filters);
      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;

      expect(payload).not.toHaveProperty(
        'currently_using_any_of_technology_uids',
      );
      expect(payload).not.toHaveProperty('organization_ids');
      expect(payload).not.toHaveProperty('organization_not_locations');
    });

    it('skips undefined range bounds', async () => {
      axiosPost.mockResolvedValue(makeOrgResponse());
      await service.searchCompanies(1, {
        latestFundingAmountRange: { min: undefined },
      });

      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('latest_funding_amount_range[min]');
    });

    it('does NOT forward people-specific params to org search', async () => {
      axiosPost.mockResolvedValue(makeOrgResponse());
      await service.searchCompanies(1, {
        personTitles: ['CTO'],
        personSeniorities: ['c_suite'] as IcpFiltersDto['personSeniorities'],
        keywords: 'enterprise CRM',
      });

      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('person_titles');
      expect(payload).not.toHaveProperty('person_seniorities');
      expect(payload).not.toHaveProperty('q_keywords');
    });

    it('returns mapped organizations and pagination', async () => {
      axiosPost.mockResolvedValue(
        makeOrgResponse([{ id: 'org1', name: 'Acme', industry: 'SaaS' }]),
      );

      const result = await service.searchCompanies(1, {});
      expect(result.organizations).toHaveLength(1);
      expect(result.organizations[0].id).toBe('org1');
      expect(result.pagination.total_entries).toBe(1);
    });

    it('throws ForbiddenException on Apollo 403', async () => {
      axiosPost.mockRejectedValue({
        response: { status: 403, data: { error: 'Forbidden' } },
        message: 'Request failed',
      });

      await expect(service.searchCompanies(1, {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadGatewayException on other Apollo errors', async () => {
      axiosPost.mockRejectedValue({
        response: { status: 500, data: { message: 'Internal error' } },
        message: 'Request failed',
      });

      await expect(service.searchCompanies(1, {})).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  // ── searchContacts ─────────────────────────────────────────────────────────

  describe('searchContacts', () => {
    it('sends sort_ascending=false by default', async () => {
      axiosPost.mockResolvedValue(makePeopleResponse());
      await service.searchContacts(1, {});

      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;
      expect(payload['sort_ascending']).toBe(false);
    });

    it('maps person-specific filters', async () => {
      axiosPost.mockResolvedValue(makePeopleResponse());
      const filters: IcpFiltersDto = {
        personTitles: ['VP of Sales', 'CTO'],
        personSeniorities: [
          'vp',
          'c_suite',
        ] as IcpFiltersDto['personSeniorities'],
        contactEmailStatus: ['verified'] as IcpFiltersDto['contactEmailStatus'],
        keywords: 'enterprise CRM',
      };

      await service.searchContacts(1, filters);
      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;

      expect(payload['person_titles']).toEqual(['VP of Sales', 'CTO']);
      expect(payload['person_seniorities']).toEqual(['vp', 'c_suite']);
      expect(payload['contact_email_status']).toEqual(['verified']);
      expect(payload['q_keywords']).toBe('enterprise CRM');
    });

    it('includes includeSimilarTitles=false (falsy but explicitly set)', async () => {
      axiosPost.mockResolvedValue(makePeopleResponse());
      await service.searchContacts(1, { includeSimilarTitles: false });

      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;
      expect(payload['include_similar_titles']).toBe(false);
    });

    it('omits include_similar_titles when undefined', async () => {
      axiosPost.mockResolvedValue(makePeopleResponse());
      await service.searchContacts(1, {});

      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('include_similar_titles');
    });

    it('personLocations overrides locations for person_locations', async () => {
      axiosPost.mockResolvedValue(makePeopleResponse());
      await service.searchContacts(1, {
        locations: ['United States'],
        personLocations: ['San Francisco'],
      });

      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;
      expect(payload['person_locations']).toEqual(['San Francisco']);
    });

    it('uses locations as person_locations when personLocations not set', async () => {
      axiosPost.mockResolvedValue(makePeopleResponse());
      await service.searchContacts(1, { locations: ['United States'] });

      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;
      expect(payload['person_locations']).toEqual(['United States']);
    });

    it('maps technographic filters in contacts search', async () => {
      axiosPost.mockResolvedValue(makePeopleResponse());
      await service.searchContacts(1, {
        technologiesAnyOf: ['salesforce'],
        technologiesAllOf: ['slack'],
        technologiesNoneOf: ['wordpress_org'],
      });

      const payload = axiosPost.mock.calls[0][1] as Record<string, unknown>;
      expect(payload['currently_using_any_of_technology_uids']).toEqual([
        'salesforce',
      ]);
      expect(payload['currently_using_all_of_technology_uids']).toEqual([
        'slack',
      ]);
      expect(payload['currently_not_using_any_of_technology_uids']).toEqual([
        'wordpress_org',
      ]);
    });

    it('calculates total_pages from total_entries', async () => {
      axiosPost.mockResolvedValue(makePeopleResponse([], 75));
      const result = await service.searchContacts(1, {}, 1, 25);

      expect(result.pagination.total_pages).toBe(3);
    });

    it('throws ForbiddenException on Apollo 403', async () => {
      axiosPost.mockRejectedValue({
        response: { status: 403, data: { error: 'Forbidden' } },
        message: 'Request failed',
      });

      await expect(service.searchContacts(1, {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadGatewayException on other Apollo errors', async () => {
      axiosPost.mockRejectedValue({
        response: { status: 500, data: { message: 'Server error' } },
        message: 'Request failed',
      });

      await expect(service.searchContacts(1, {})).rejects.toThrow(
        BadGatewayException,
      );
    });
  });
});
