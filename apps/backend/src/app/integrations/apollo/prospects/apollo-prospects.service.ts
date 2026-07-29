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

export interface SequenceContact {
  id: string;
  name: string;
  email?: string;
  title?: string;
  organizationName?: string;
  sequenceStatus?: string;
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

  /**
   * Enrich a person to get their verified work email via Apollo people/match.
   * Passing the Apollo person ID gives the most accurate result (1 credit consumed).
   */
  private async enrichEmail(
    organizationId: number,
    personData: {
      apolloPersonId?: string;
      firstName?: string;
      lastName?: string;
      organizationName?: string;
    },
  ): Promise<string | undefined> {
    const body: Record<string, string> = { reveal_personal_emails: 'false' };
    // Person ID gives Apollo an exact match — much more reliable than name lookup
    if (personData.apolloPersonId) body['id'] = personData.apolloPersonId;
    if (personData.firstName) body['first_name'] = personData.firstName;
    if (personData.lastName) body['last_name'] = personData.lastName;
    if (personData.organizationName)
      body['organization_name'] = personData.organizationName;

    const tryMatch = async (headers: Record<string, string>) => {
      const resp = await fetch(`${APOLLO_BASE}/people/match`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!resp.ok) return undefined;
      const data = (await resp.json()) as { person?: { email?: string } };
      return data.person?.email ?? undefined;
    };

    // OAuth account first — uses connected account's credit pool (same as Apollo UI)
    try {
      const accessToken =
        await this.apolloMcpService.getAccessToken(organizationId);
      const email = await tryMatch({
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      });
      if (email) return email;
    } catch {
      // fall through
    }

    // API key fallback
    return tryMatch(this.apiKeyHeaders());
  }

  /**
   * Ensure an existing Apollo contact has an email.
   * Fetches the contact, and if no email is stored, enriches via people/match
   * and patches the contact record in Apollo so enrollment can proceed.
   */
  private async ensureContactHasEmail(
    organizationId: number,
    contactId: string,
  ): Promise<void> {
    try {
      const accessToken =
        await this.apolloMcpService.getAccessToken(organizationId);
      const authHeader = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const resp = await fetch(`${APOLLO_BASE}/contacts/${contactId}`, {
        headers: authHeader,
      });
      if (!resp.ok) return;

      const data = (await resp.json()) as {
        contact?: {
          email?: string;
          first_name?: string;
          last_name?: string;
          organization_name?: string;
        };
      };
      if (data.contact?.email) return; // already has email — nothing to do

      const contact = data.contact;
      if (!contact) return;

      const email = await this.enrichEmail(organizationId, {
        firstName: contact.first_name,
        lastName: contact.last_name,
        organizationName: contact.organization_name,
      });

      if (!email) {
        this.logger.warn(
          `Could not find email for Apollo contact ${contactId} — may be skipped by sequence enrollment`,
        );
        return;
      }

      // Patch the contact in Apollo so enrollment can find the email
      await fetch(`${APOLLO_BASE}/contacts/${contactId}`, {
        method: 'PUT',
        headers: authHeader,
        body: JSON.stringify({ email }),
      });
    } catch {
      // non-fatal
    }
  }

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
          let email = personData.email;
          if (!email) {
            email = await this.enrichEmail(organizationId, {
              apolloPersonId: personId,
              ...personData,
            });
          }

          const result =
            await this.apolloMcpService.callTool<McpContactCreateResult>(
              organizationId,
              'apollo_contacts_create',
              {
                first_name: personData.firstName ?? '',
                last_name: personData.lastName ?? '',
                organization_name: personData.organizationName ?? '',
                ...(email ? { email } : {}),
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
              .create({
                organizationId,
                name,
                apolloPersonId: personId,
                apolloContactId: contactId,
              })
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
    // For existing contacts missing an email, enrich and patch Apollo before enrollment.
    await Promise.all(
      dto.contactIds.map((contactId) =>
        this.ensureContactHasEmail(organizationId, contactId),
      ),
    );
    const enrichedContactIds = dto.contactIds;

    const allContactIds = [...enrichedContactIds, ...convertedContactIds];
    let result: unknown = null;

    if (allContactIds.length > 0) {
      // Get email account via MCP (OAuth context), fall back to API key
      interface EmailAccountResult {
        email_accounts?: Array<{ id: string; active?: boolean }>;
      }
      const mcpEmailAccounts = await this.apolloMcpService
        .callTool<EmailAccountResult>(
          organizationId,
          'apollo_email_accounts_index',
          {},
        )
        .catch(() => null);

      let emailAccountId = mcpEmailAccounts?.email_accounts?.find(
        (a) => a.active !== false,
      )?.id;

      if (!emailAccountId) {
        const emailAccountsResp = await fetch(`${APOLLO_BASE}/email_accounts`, {
          headers: this.apiKeyHeaders(),
        });
        if (emailAccountsResp.ok) {
          const data = (await emailAccountsResp.json()) as {
            email_accounts?: Array<{ id: string; active?: boolean }>;
          };
          emailAccountId = data.email_accounts?.find(
            (a) => a.active !== false,
          )?.id;
        }
      }

      if (!emailAccountId) {
        throw new BadGatewayException(
          'No email inbox connected in Apollo. Go to Apollo → Settings → Mailboxes and connect an inbox.',
        );
      }

      // MCP schema requires both id + emailer_campaign_id (same value)
      result = await this.apolloMcpService.callTool(
        organizationId,
        'apollo_emailer_campaigns_add_contact_ids',
        {
          id: dto.sequenceId,
          emailer_campaign_id: dto.sequenceId,
          contact_ids: allContactIds,
          send_email_from_email_account_id: emailAccountId,
          sequence_active_in_other_campaigns: true,
        },
      );
    }

    return { result, failedPersonIds };
  }

  // ─── Sequence contacts ───────────────────────────────────────────────────────

  async getSequenceContacts(
    organizationId: number,
    sequenceId: string,
  ): Promise<SequenceContact[]> {
    // Contacts belong to the OAuth account (created via MCP) — must use Bearer token
    const accessToken =
      await this.apolloMcpService.getAccessToken(organizationId);
    const resp = await fetch(`${APOLLO_BASE}/contacts/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailer_campaign_ids: [sequenceId],
        per_page: 100,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      this.handleFetchError('getSequenceContacts', resp.status, body);
    }

    const data = (await resp.json()) as {
      contacts?: Array<{
        id: string;
        name?: string;
        first_name?: string;
        last_name?: string;
        email?: string;
        title?: string;
        organization_name?: string;
        contact_campaign_statuses?: Array<{
          emailer_campaign_id: string;
          status: string;
        }>;
      }>;
    };

    return (data.contacts ?? []).map((c) => {
      const seqStatus = c.contact_campaign_statuses?.find(
        (s) => s.emailer_campaign_id === sequenceId,
      )?.status;
      return {
        id: c.id,
        name:
          c.name ??
          ([c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unknown'),
        email: c.email,
        title: c.title,
        organizationName: c.organization_name,
        sequenceStatus: seqStatus,
      };
    });
  }
}
