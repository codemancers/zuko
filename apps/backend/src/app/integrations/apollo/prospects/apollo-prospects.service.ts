import {
  Injectable,
  Logger,
  BadGatewayException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApolloMcpService } from '../apollo-mcp.service';
import { ContactsRepository } from '@zuko/sales';
import type {
  SearchProspectsDto,
  AddPeopleToSequenceDto,
} from './dto/prospects.dto';

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

// ─── Apollo REST response shapes ─────────────────────────────────────────────

// Response shape from /mixed_people/api_search (API key endpoint)
// Last name is obfuscated until enriched (no credits consumed for basic search)
interface ApolloPersonRaw {
  id: string;
  /** Full name — present on contacts/search but not mixed_people/api_search */
  name?: string;
  first_name?: string;
  last_name?: string;
  last_name_obfuscated?: string;
  title?: string;
  city?: string;
  state?: string;
  country?: string;
  photo_url?: string | null;
  linkedin_url?: string | null;
  /** Set when the person already exists as a contact in the org's Apollo account */
  contact_id?: string | null;
  organization_name?: string;
  organization?: {
    id?: string;
    name?: string;
    primary_domain?: string;
  };
}

interface ApolloMixedPeopleResponse {
  people?: ApolloPersonRaw[];
  contacts?: ApolloPersonRaw[];
  pagination?: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

// (ApolloOrgSearchRaw kept for potential future use)

// ─── Apollo MCP response shapes ───────────────────────────────────────────────

interface McpContactCreateResult {
  contact?: {
    id: string;
    name: string;
  };
  id?: string;
}

// ─── Public response shapes ───────────────────────────────────────────────────

export interface ProspectPerson {
  /** Apollo person/contact ID */
  id: string;
  /** Set when the person is already a Zuko CRM contact */
  contactId?: string;
  isContact: boolean;
  name: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  city?: string;
  state?: string;
  country?: string;
  photoUrl?: string;
  linkedinUrl?: string;
  organizationName?: string;
  organization?: {
    id?: string;
    name?: string;
    primaryDomain?: string;
  };
}

export interface ProspectsSearchResponse {
  people: ProspectPerson[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

export interface OrgSearchResult {
  id: string;
  name: string;
  /** Primary domain e.g. "codemancers.com" — used for q_organization_domains_list filter */
  domain?: string;
}

export interface AddToSequenceResult {
  result: unknown;
  failedPersonIds: string[];
}

@Injectable()
export class ApolloProspectsService {
  private readonly logger = new Logger(ApolloProspectsService.name);

  constructor(
    private readonly apolloMcpService: ApolloMcpService,
    private readonly contactsRepository: ContactsRepository,
    private readonly configService: ConfigService,
  ) {}

  // ─── Auth ────────────────────────────────────────────────────────────────────

  /** API key auth — used for prospect/org search endpoints. */
  private apiKeyHeaders(): Record<string, string> {
    const key = this.configService.getOrThrow<string>('APOLLO_API_KEY');
    return {
      'x-api-key': key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private handleFetchError(
    context: string,
    status: number,
    body: string,
  ): never {
    this.logger.error(`[APOLLO] ${context} failed: HTTP ${status} — ${body}`);
    if (status === 403 || status === 401) {
      throw new ForbiddenException(
        'Apollo API access denied. Please check your connection.',
      );
    }
    throw new BadGatewayException(
      `Apollo API error (${context}, HTTP ${status})`,
    );
  }

  // ─── People search ──────────────────────────────────────────────────────────

  async searchPeople(
    organizationId: number,
    dto: SearchProspectsDto,
  ): Promise<ProspectsSearchResponse> {
    const page = dto.page ?? 1;
    const perPage = dto.perPage ?? 25;

    this.logger.debug(
      `[APOLLO] searchPeople page=${page} filters=${JSON.stringify({
        personName: dto.personName,
        titles: dto.personTitles,
        locations: dto.personLocations,
        orgIds: dto.organizationIds,
        orgDomains: dto.organizationDomains,
      })}`,
    );

    // Use API key + /mixed_people/api_search — free for basic profile data
    // contacts/search — searches only contacts saved in your Apollo CRM.
    // Completely free, no enrichment credits consumed ever.
    // mixed_people/api_search — searches Apollo's full 230M+ prospect database.
    // Per Apollo's API pricing docs (docs.apollo.io/docs/api-pricing), this
    // endpoint is NOT listed as credit-consuming. Credits are only charged for
    // enrichment endpoints (people/match, organizations/enrich) and
    // mixed_companies/search. Basic profile search is free.
    const body: Record<string, unknown> = { page, per_page: perPage };

    if (dto.personName?.trim()) body['q_keywords'] = dto.personName.trim();
    if (dto.personTitles?.length) body['person_titles'] = dto.personTitles;
    if (dto.personLocations?.length)
      body['person_locations'] = dto.personLocations;
    // Prefer domain filter over org ID — domains work more reliably.
    // Don't send both simultaneously as they conflict.
    if (dto.organizationDomains?.length) {
      body['q_organization_domains_list'] = dto.organizationDomains;
    } else if (dto.organizationIds?.length) {
      body['organization_ids'] = dto.organizationIds;
    }

    // Use OAuth Bearer token. Requires mixed_people_api_search scope on
    // the Apollo OAuth app (confirmed registered).
    const response = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
      method: 'POST',
      headers: this.apiKeyHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      this.handleFetchError('searchPeople', response.status, errBody);
    }

    const data = (await response.json()) as ApolloMixedPeopleResponse;

    const rawPeople = [...(data.people ?? []), ...(data.contacts ?? [])];
    const seen = new Set<string>();
    const deduped = rawPeople.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    const people: ProspectPerson[] = deduped.map((p) => ({
      id: p.id,
      contactId: p.contact_id ?? undefined,
      isContact: Boolean(p.contact_id),
      // Compose display name from available fields
      name:
        p.name ??
        (p.first_name || p.last_name || p.last_name_obfuscated
          ? [p.first_name, p.last_name ?? p.last_name_obfuscated]
              .filter(Boolean)
              .join(' ')
          : 'Unknown'),
      firstName: p.first_name,
      lastName: p.last_name,
      title: p.title,
      city: p.city,
      state: p.state,
      country: p.country,
      photoUrl: p.photo_url ?? undefined,
      linkedinUrl: p.linkedin_url ?? undefined,
      organizationName:
        p.organization?.name ?? p.organization_name ?? undefined,
      organization: p.organization
        ? {
            id: p.organization.id,
            name: p.organization.name,
            primaryDomain: p.organization.primary_domain,
          }
        : undefined,
    }));

    return {
      people,
      pagination: data.pagination ?? {
        page,
        per_page: perPage,
        total_entries: people.length,
        total_pages: 1,
      },
    };
  }
  // ─── Organization name autocomplete ────────────────────────────────────────
  // NOTE: mixed_companies/search costs credits (per Apollo API pricing docs).
  // We use accounts/search instead — searches your Apollo CRM accounts, free.

  async searchOrganizations(
    organizationId: number,
    name: string,
  ): Promise<OrgSearchResult[]> {
    if (!name?.trim()) return [];

    this.logger.debug(`[APOLLO] searchOrganizations name="${name}"`);

    const params = new URLSearchParams({
      q_organization_name: name.trim(),
      per_page: '10',
    });

    const response = await fetch(
      `${APOLLO_BASE}/accounts/search?${params.toString()}`,
      {
        method: 'GET',
        headers: this.apiKeyHeaders(),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.handleFetchError('searchOrganizations', response.status, body);
    }

    const data = (await response.json()) as {
      organizations?: Array<{
        id: string;
        name: string;
        primary_domain?: string;
        domain?: string;
      }>;
      accounts?: Array<{
        id: string;
        name: string;
        primary_domain?: string;
        domain?: string;
      }>;
    };

    const results = data.organizations ?? data.accounts ?? [];
    return results.map((o) => ({
      id: o.id,
      name: o.name,
      domain: o.primary_domain ?? o.domain,
    }));
  }

  // ─── Add people to sequence ─────────────────────────────────────────────────

  async addPeopleToSequence(
    organizationId: number,
    dto: AddPeopleToSequenceDto,
  ): Promise<AddToSequenceResult> {
    const failedPersonIds: string[] = [];

    // Step 1: Materialize raw prospects into Apollo contacts so they get a
    // contact_id that apollo_emailer_campaigns_add_contact_ids requires.
    const convertedContactIds: string[] = [];

    await Promise.all(
      dto.personIds.map(async (personId, index) => {
        const personData = dto.personData[index] ?? {};
        try {
          const result =
            await this.apolloMcpService.callTool<McpContactCreateResult>(
              organizationId,
              'apollo_contacts_create',
              {
                _conversation_ref: `zuko_${organizationId}`,
                _rationale: 'Adding prospect to sequence from Zuko',
                first_name: personData.firstName ?? '',
                last_name: personData.lastName ?? '',
                organization_name: personData.organizationName ?? '',
                // Pass the Apollo person ID so Apollo links the contact to its
                // existing person record rather than creating a duplicate.
                person_id: personId,
              },
            );

          const contactId = result?.contact?.id ?? result?.id;

          if (contactId) {
            convertedContactIds.push(contactId);

            // Also persist a lightweight Zuko CRM contact for future reference.
            const name =
              [personData.firstName, personData.lastName]
                .filter(Boolean)
                .join(' ')
                .trim() ||
              personData.organizationName ||
              'Unknown';

            await this.contactsRepository
              .create({ organizationId, name })
              .catch((err: unknown) => {
                // Non-fatal — CRM record creation is best-effort.
                this.logger.warn(
                  `Failed to create Zuko CRM contact for personId=${personId}: ${err instanceof Error ? err.message : String(err)}`,
                );
              });
          } else {
            this.logger.warn(
              `apollo_contacts_create returned no id for personId=${personId}`,
            );
            failedPersonIds.push(personId);
          }
        } catch (err) {
          this.logger.warn(
            `Failed to convert personId=${personId} to Apollo contact: ${err instanceof Error ? err.message : String(err)}`,
          );
          failedPersonIds.push(personId);
        }
      }),
    );

    // Step 2: Enroll all contact IDs (existing + freshly converted) into the sequence.
    const allContactIds = [...dto.contactIds, ...convertedContactIds];

    let result: unknown = null;

    if (allContactIds.length > 0) {
      result = await this.apolloMcpService.callTool(
        organizationId,
        'apollo_emailer_campaigns_add_contact_ids',
        {
          _conversation_ref: `zuko_${organizationId}`,
          _rationale: 'Enrolling contacts into sequence from Zuko',
          id: dto.sequenceId,
          contact_ids: allContactIds,
        },
      );
    }

    return { result, failedPersonIds };
  }
}
