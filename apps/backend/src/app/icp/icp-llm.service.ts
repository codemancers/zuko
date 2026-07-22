import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import type { IcpFiltersDto } from './dto/icp.dto';

const filtersSchema = z.object({
  industries: z
    .array(z.string())
    .optional()
    .describe('Industry keywords e.g. saas, fintech'),
  employeeRanges: z
    .array(z.string())
    .optional()
    .describe(
      'Apollo "min,max" format e.g. "50,200", "201,500", "501,1000", "1001,5000"',
    ),
  locations: z
    .array(z.string())
    .optional()
    .describe('Country or US state names'),
  revenueRange: z
    .object({ min: z.number().optional(), max: z.number().optional() })
    .optional()
    .describe('Annual revenue in USD integers'),
  excludeLocations: z
    .array(z.string())
    .optional()
    .describe('Locations to exclude'),
  organizationName: z
    .string()
    .optional()
    .describe('Company name for partial match'),
  organizationDomains: z
    .array(z.string())
    .optional()
    .describe('Domain names e.g. apollo.io'),
  technologiesAnyOf: z
    .array(z.string())
    .optional()
    .describe(
      'Apollo tech UIDs: salesforce, hubspot, infor, microsoft_dynamics, slack, etc.',
    ),
  technologiesAllOf: z
    .array(z.string())
    .optional()
    .describe('Must use ALL of these tech UIDs'),
  technologiesNoneOf: z
    .array(z.string())
    .optional()
    .describe('Exclude companies using these tech UIDs'),
  latestFundingAmountRange: z
    .object({ min: z.number().optional(), max: z.number().optional() })
    .optional()
    .describe('Latest funding round amount in USD'),
  totalFundingRange: z
    .object({ min: z.number().optional(), max: z.number().optional() })
    .optional()
    .describe('Total cumulative funding in USD'),
  latestFundingDateRange: z
    .object({ min: z.string().optional(), max: z.string().optional() })
    .optional()
    .describe('Date range YYYY-MM-DD for latest funding round'),
  personTitles: z
    .array(z.string())
    .optional()
    .describe('Job titles to target e.g. "VP of Sales"'),
  personSeniorities: z
    .array(
      z.enum([
        'owner',
        'founder',
        'c_suite',
        'partner',
        'vp',
        'head',
        'director',
        'manager',
        'senior',
        'entry',
        'intern',
      ]),
    )
    .optional()
    .describe('Seniority levels'),
  personLocations: z
    .array(z.string())
    .optional()
    .describe('Person locations (overrides locations for people search)'),
  contactEmailStatus: z
    .array(
      z.enum(['verified', 'unverified', 'likely to engage', 'unavailable']),
    )
    .optional()
    .describe('Email quality filter'),
  keywords: z.string().optional().describe('Free-text keyword search'),
});

const SYSTEM_PROMPT = `You are a B2B sales expert. Parse the ICP (Ideal Customer Profile) description and extract structured Apollo.io search filters.

Rules:
- employeeRanges: use Apollo bracket format "min,max" — valid brackets: "1,10", "11,20", "21,50", "51,100", "101,200", "201,500", "501,1000", "1001,5000", "5001,10000", "10001,+"
- technologiesAnyOf: use Apollo technology UIDs (snake_case, e.g. "salesforce", "hubspot", "infor", "microsoft_dynamics", "slack", "zendesk")
- personSeniorities: use only the provided enum values
- locations: use full country names or US state names (e.g. "United States", "United Kingdom", "California")
- revenue values: USD integers without symbols (e.g. 1000000 for $1M)
- Only include fields explicitly mentioned or strongly implied; omit everything else`;

@Injectable()
export class IcpLlmService {
  private readonly logger = new Logger(IcpLlmService.name);
  private readonly openai;

  constructor(config: ConfigService) {
    this.openai = createOpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  async compileDescription(description: string): Promise<IcpFiltersDto> {
    if (!description.trim()) {
      throw new BadRequestException('Description is empty');
    }

    this.logger.debug('[ICP-LLM] Compiling description into Apollo filters');

    const { object } = await generateObject({
      model: this.openai('gpt-4o-mini'),
      schema: filtersSchema,
      system: SYSTEM_PROMPT,
      prompt: description,
    });

    return object as IcpFiltersDto;
  }
}
