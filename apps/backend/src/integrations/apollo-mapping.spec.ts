import { describe, expect, it } from 'vitest';
import {
  matchOrganization,
  matchPerson,
  normalizeDomain,
  organizationQuery,
  personQuery,
  planUpdate,
} from './apollo-mapping';

describe('normalizeDomain', () => {
  it('reduces a url to its host', () => {
    expect(normalizeDomain('https://www.Example.com/about?x=1')).toBe('example.com');
    expect(normalizeDomain('example.com')).toBe('example.com');
  });
  it('rejects things that are not a domain', () => {
    expect(normalizeDomain('Example')).toBeUndefined();
    expect(normalizeDomain('')).toBeUndefined();
    expect(normalizeDomain(42)).toBeUndefined();
  });
});

describe('personQuery', () => {
  it('matches on an email alone', () => {
    expect(personQuery({ email: 'a@b.co' }, {})).toEqual({ email: 'a@b.co' });
  });
  it('needs the company when there is only a name', () => {
    expect(personQuery({ first_name: 'Ada', last_name: 'Lovelace' }, {})).toBeNull();
    expect(personQuery({ first_name: 'Ada' }, { domain: 'b.co' })).toBeNull();
    expect(personQuery({ first_name: 'Ada', last_name: 'Lovelace' }, { domain: 'https://b.co' })).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
      domain: 'b.co',
    });
  });
});

describe('organizationQuery', () => {
  it('uses the record domain, else the hint', () => {
    expect(organizationQuery({ domain: 'https://x.io' }, {})).toEqual({ domain: 'x.io' });
    expect(organizationQuery({}, { domain: 'y.io' })).toEqual({ domain: 'y.io' });
    expect(organizationQuery({ name: 'X' }, {})).toBeNull();
  });
});

describe('matchPerson', () => {
  it('maps the person and drops a locked email', () => {
    const match = matchPerson({
      person: {
        id: 'p1',
        first_name: 'Ada',
        last_name: 'Lovelace',
        title: 'CTO',
        email: 'email_not_unlocked@b.co',
        phone_numbers: [{ sanitized_number: '+15551234' }],
      },
    });
    expect(match).toEqual({
      externalId: 'p1',
      values: { first_name: 'Ada', last_name: 'Lovelace', job_title: 'CTO', phone: '+15551234' },
    });
  });
  it('keeps a revealed email', () => {
    expect(matchPerson({ person: { id: 'p', email: 'ada@b.co' } })?.values).toEqual({ email: 'ada@b.co' });
  });
  it('is null when nothing matched', () => {
    expect(matchPerson({ person: null })).toBeNull();
    expect(matchPerson(null)).toBeNull();
  });
});

describe('matchOrganization', () => {
  it('maps the company', () => {
    expect(
      matchOrganization({
        organization: { id: 'o1', name: 'Acme', primary_domain: 'acme.com', industry: 'retail', estimated_num_employees: 120, city: 'Pune', annual_revenue: 5e6 },
      }),
    ).toEqual({
      externalId: 'o1',
      values: { name: 'Acme', domain: 'acme.com', industry: 'retail', employee_count: 120, city: 'Pune', annual_revenue: 5e6 },
    });
  });
  it('is null without an organization', () => {
    expect(matchOrganization({})).toBeNull();
  });
});

describe('planUpdate', () => {
  const fields = new Set(['name', 'city', 'industry']);
  it('fills only empty fields on the object', () => {
    const plan = planUpdate({ name: 'Acme', city: 'Pune', industry: 'x', domain: 'a.com' }, { name: 'Mine', industry: '' }, fields);
    expect(plan.set).toEqual({ city: 'Pune', industry: 'x' });
    expect(plan.skipped).toEqual([
      { field: 'name', reason: 'ALREADY_SET' },
      { field: 'domain', reason: 'NO_SUCH_FIELD' },
    ]);
  });
  it('replaces existing values only when asked', () => {
    expect(planUpdate({ name: 'Acme' }, { name: 'Mine' }, fields, true).set).toEqual({ name: 'Acme' });
  });
});
