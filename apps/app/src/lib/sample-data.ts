/**
 * A few realistic rows per standard object, so an empty CRM can be tried out in one click.
 * `key` says how to tell whether a row is already there, so loading twice adds nothing; `links`
 * names who it is linked to: a company by its name, a contact by its email.
 */
export interface Sample {
  properties: Record<string, unknown>;
  key: { field: string; value: string };
  links?: { company?: string; contact?: string };
}

const contact = (
  first_name: string,
  last_name: string,
  email: string,
  job_title: string,
  lifecycle_stage: string,
  company: string,
): Sample => ({
  properties: { first_name, last_name, email, job_title, lifecycle_stage },
  key: { field: 'email', value: email },
  links: { company },
});

const deal = (
  name: string,
  amount: number,
  stage: string,
  expected_close_date: string,
  company: string,
  contactEmail: string,
): Sample => ({
  properties: { name, amount, stage, expected_close_date },
  key: { field: 'name', value: name },
  links: { company, contact: contactEmail },
});

export const SAMPLE_RECORDS: Record<string, Sample[]> = {
  contact: [
    contact(
      'Ada',
      'Lovelace',
      'ada@analytical.example',
      'Chief Mathematician',
      'customer',
      'Analytical Engines',
    ),
    contact('Grace', 'Hopper', 'grace@navy.example', 'Rear Admiral', 'qualified', 'Cobol Systems'),
    contact('Alan', 'Turing', 'alan@bletchley.example', 'Cryptanalyst', 'lead', 'Bletchley Labs'),
    contact(
      'Katherine',
      'Johnson',
      'katherine@orbit.example',
      'Research Mathematician',
      'customer',
      'Orbit Dynamics',
    ),
    contact(
      'Linus',
      'Torvalds',
      'linus@kernel.example',
      'Maintainer',
      'subscriber',
      'Kernel Works',
    ),
    contact(
      'Margaret',
      'Hamilton',
      'margaret@apollo.example',
      'Director of Software',
      'qualified',
      'Apollo Software',
    ),
  ],
  company: [
    {
      name: 'Analytical Engines',
      domain: 'analytical.example',
      industry: 'Computing',
      employee_count: 120,
      city: 'London',
      annual_revenue: 9500000,
    },
    {
      name: 'Cobol Systems',
      domain: 'cobolsystems.example',
      industry: 'Software',
      employee_count: 450,
      city: 'New York',
      annual_revenue: 48000000,
    },
    {
      name: 'Bletchley Labs',
      domain: 'bletchley.example',
      industry: 'Security',
      employee_count: 60,
      city: 'Milton Keynes',
      annual_revenue: 3200000,
    },
    {
      name: 'Orbit Dynamics',
      domain: 'orbit.example',
      industry: 'Aerospace',
      employee_count: 900,
      city: 'Hampton',
      annual_revenue: 120000000,
    },
    {
      name: 'Kernel Works',
      domain: 'kernel.example',
      industry: 'Open source',
      employee_count: 35,
      city: 'Portland',
      annual_revenue: 1800000,
    },
  ].map((properties): Sample => ({ properties, key: { field: 'name', value: properties.name } })),
  deal: [
    deal(
      'Analytical Engines renewal',
      42000,
      'negotiation',
      '2027-01-15',
      'Analytical Engines',
      'ada@analytical.example',
    ),
    deal(
      'Cobol Systems expansion',
      180000,
      'proposal',
      '2027-02-28',
      'Cobol Systems',
      'grace@navy.example',
    ),
    deal(
      'Bletchley pilot',
      15000,
      'qualified',
      '2026-12-20',
      'Bletchley Labs',
      'alan@bletchley.example',
    ),
    deal(
      'Orbit platform licence',
      360000,
      'won',
      '2026-11-30',
      'Orbit Dynamics',
      'katherine@orbit.example',
    ),
    deal(
      'Kernel Works support plan',
      8000,
      'new',
      '2027-03-31',
      'Kernel Works',
      'linus@kernel.example',
    ),
    deal('Apollo audit', 25000, 'lost', '2026-10-31', 'Apollo Software', 'margaret@apollo.example'),
  ],
};
