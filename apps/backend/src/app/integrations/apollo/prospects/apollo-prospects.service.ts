import {
  Injectable,
  Logger,
  BadGatewayException,
  ForbiddenException,
} from '@nestjs/common';
import { ApolloIntegrationService } from '../apollo-integration.service';
import { ApolloMcpService } from '../apollo-mcp.service';
import { ContactsRepository } from '@zuko/sales';
import type {
  SearchProspectsDto,
  AddPeopleToSequenceDto,
} from './dto/prospects.dto';

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

// ─── Apollo REST response shapes ─────────────────────────────────────────────

interface ApolloPersonRaw {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
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
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

interface ApolloOrgSearchRaw {
  id: string;
  name: string;
}

interface ApolloOrgSearchResponse {
  organizations?: ApolloOrgSearchRaw[];
}

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
}

export interface AddToSequenceResult {
  result: unknown;
  failedPersonIds: string[];
}

@Injectable()
export class ApolloProspectsService {
  private readonly logger = new Logger(ApolloProspectsService.name);

  constructor(
    private readonly apolloIntegrationService: ApolloIntegrationService,
    private readonly apolloMcpService: ApolloMcpService,
    private readonly contactsRepository: ContactsRepository,
  ) {}

  // ─── Auth helpers ───────────────────────────────────────────────────────────

  private async authHeaders(organizationId: number) {
    const accessToken =
      await this.apolloIntegrationService.getAccessToken(organizationId);
    return {
      Authorization: `Bearer ${accessToken}`,
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

    const payload: Record<string, unknown> = {
      page,
      per_page: perPage,
      contact_type_tags: ['contact', 'prospect'],
    };

    if (dto.personName?.trim()) {
      payload['q_keywords'] = dto.personName.trim();
    }
    if (dto.personTitles?.length) {
      payload['person_titles'] = dto.personTitles;
    }
    if (dto.personLocations?.length) {
      payload['person_locations'] = dto.personLocations;
    }
    if (dto.organizationIds?.length) {
      payload['organization_ids'] = dto.organizationIds;
    }

    this.logger.debug(
      `[APOLLO] searchPeople org=${organizationId} page=${page} filters=${JSON.stringify(
        {
          personName: dto.personName,
          titles: dto.personTitles,
          locations: dto.personLocations,
          orgIds: dto.organizationIds,
        },
      )}`,
    );

    const response = await fetch(`${APOLLO_BASE}/mixed_people/search`, {
      method: 'POST',
      headers: await this.authHeaders(organizationId),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      this.handleFetchError('searchPeople', response.status, body);
    }

    const data = (await response.json()) as ApolloMixedPeopleResponse;

    // Apollo may return results under `people` or `contacts` depending on the
    // contact_type_tags filter — merge both arrays, deduplicating by id.
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
      name: p.name,
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

    return { people, pagination: data.pagination };
  }

  // ─── Organization name autocomplete ────────────────────────────────────────

  async searchOrganizations(
    organizationId: number,
    name: string,
  ): Promise<OrgSearchResult[]> {
    if (!name?.trim()) return [];

    const params = new URLSearchParams({
      q_organization_name: name.trim(),
      per_page: '10',
    });

    this.logger.debug(
      `[APOLLO] searchOrganizations org=${organizationId} name="${name}"`,
    );

    const response = await fetch(
      `${APOLLO_BASE}/mixed_companies/search?${params.toString()}`,
      {
        method: 'GET',
        headers: await this.authHeaders(organizationId),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      this.handleFetchError('searchOrganizations', response.status, body);
    }

    const data = (await response.json()) as ApolloOrgSearchResponse;
    return (data.organizations ?? []).map((o) => ({ id: o.id, name: o.name }));
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
