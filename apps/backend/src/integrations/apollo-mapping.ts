/**
 * What Apollo is asked and how its answer lands on a record. Pure functions: the service does the
 * calling and the saving. Apollo's response is the provider's shape and is stored whole; only the
 * handful of values below are copied into record fields.
 */

export type Subject = 'PERSON' | 'ORGANIZATION';

/** The standard objects Apollo can describe, and which of its two lookups applies. */
export const SUBJECT_BY_OBJECT: Readonly<Record<string, Subject>> = {
  contact: 'PERSON',
  prospect: 'PERSON',
  lead: 'PERSON',
  company: 'ORGANIZATION',
};

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const count = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/** `https://www.Example.com/about` -> `example.com`. */
export function normalizeDomain(raw: unknown): string | undefined {
  const value = text(raw);
  if (!value) return undefined;
  const host = value.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0]?.toLowerCase();
  return host && host.includes('.') ? host : undefined;
}

export interface Hints {
  /** The person's company, when the record does not say (it is a link, not a field). */
  domain?: string | undefined;
  organization_name?: string | undefined;
}

/** Apollo's people match needs an email, or a name plus the company. Null when the record gives neither. */
export function personQuery(props: Json, hints: Hints): Record<string, string> | null {
  const email = text(props['email']);
  const first = text(props['first_name']);
  const last = text(props['last_name']);
  const domain = normalizeDomain(hints.domain);
  const organization = text(hints.organization_name);
  const query: Record<string, string> = {};
  if (email) query['email'] = email;
  if (first) query['first_name'] = first;
  if (last) query['last_name'] = last;
  if (domain) query['domain'] = domain;
  if (organization) query['organization_name'] = organization;
  const named = Boolean(first && last && (domain || organization));
  return email || named ? query : null;
}

/** Apollo's organization enrichment is by domain only. */
export function organizationQuery(props: Json, hints: Hints): Record<string, string> | null {
  const domain = normalizeDomain(props['domain']) ?? normalizeDomain(hints.domain);
  return domain ? { domain } : null;
}

export interface Match {
  externalId: string | null;
  /** Record field values Apollo knows. The service decides which of them to write. */
  values: Record<string, unknown>;
}

/** Apollo hides an email it has not revealed behind a placeholder address; that is not data. */
const lockedEmail = (email: string) => /not_unlocked/i.test(email);

export function matchPerson(payload: unknown): Match | null {
  const person = isObject(payload) ? payload['person'] : undefined;
  if (!isObject(person)) return null;
  const email = text(person['email']);
  const phones = Array.isArray(person['phone_numbers']) ? person['phone_numbers'] : [];
  const phone = phones.map((p) => (isObject(p) ? text(p['sanitized_number']) ?? text(p['raw_number']) : undefined)).find(Boolean);
  return {
    externalId: text(person['id']) ?? null,
    values: strip({
      first_name: text(person['first_name']),
      last_name: text(person['last_name']),
      email: email && !lockedEmail(email) ? email : undefined,
      job_title: text(person['title']),
      phone,
    }),
  };
}

export function matchOrganization(payload: unknown): Match | null {
  const organization = isObject(payload) ? payload['organization'] : undefined;
  if (!isObject(organization)) return null;
  return {
    externalId: text(organization['id']) ?? null,
    values: strip({
      name: text(organization['name']),
      domain: normalizeDomain(organization['primary_domain']),
      industry: text(organization['industry']),
      employee_count: count(organization['estimated_num_employees']),
      city: text(organization['city']),
      annual_revenue: count(organization['annual_revenue']),
    }),
  };
}

const strip = (values: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));

export interface Plan {
  set: Record<string, unknown>;
  skipped: { field: string; reason: 'ALREADY_SET' | 'NO_SUCH_FIELD' }[];
}

/**
 * Which of Apollo's values to write. Existing values win: a person typed them, and an enrichment must
 * not silently replace them. Fields the object does not have are left out.
 */
export function planUpdate(
  values: Record<string, unknown>,
  current: Json,
  fieldNames: ReadonlySet<string>,
  overwrite = false,
): Plan {
  const plan: Plan = { set: {}, skipped: [] };
  for (const [field, value] of Object.entries(values)) {
    if (!fieldNames.has(field)) {
      plan.skipped.push({ field, reason: 'NO_SUCH_FIELD' });
    } else if (!overwrite && current[field] !== undefined && current[field] !== null && current[field] !== '') {
      plan.skipped.push({ field, reason: 'ALREADY_SET' });
    } else {
      plan.set[field] = value;
    }
  }
  return plan;
}
