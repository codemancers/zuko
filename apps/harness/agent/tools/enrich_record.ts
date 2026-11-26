import { defineTool } from 'eve/tools';
import * as z from 'zod';
import { object, recordId } from '../lib/schemas';
import { crmRequest, recordsPath, segment, crmOutput } from '../lib/backend';

export default defineTool({
  description:
    'Look a contact, prospect, lead or company up in Apollo and fill its empty fields (job title, phone, industry, headcount and so on) from what Apollo knows. ' +
    'It spends Apollo credits, so call it only when the person asked for enrichment, once per record. Fields that already have a value are never replaced unless overwrite is true. ' +
    'A person needs an email, or a first and last name plus domain or organization_name; a company needs its domain.',
  inputSchema: z.object({
    object,
    id: recordId,
    domain: z.string().optional().describe("The person's company website domain, when the record does not have an email."),
    organization_name: z.string().optional().describe("The person's company name, when the record does not have an email."),
    overwrite: z.boolean().optional().describe('Replace values the record already has. Only when the person asks for it.'),
  }),
  execute: (input, ctx) =>
    crmRequest(ctx, 'POST', `${recordsPath(input.object)}/${segment(input.id)}/enrich`, {
      domain: input.domain,
      organization_name: input.organization_name,
      overwrite: input.overwrite,
    }),
  toModelOutput: crmOutput,
});
