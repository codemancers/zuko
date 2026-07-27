import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IcpLlmService } from './icp-llm.service';

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => {
    const fn = vi.fn(() => 'mock-model');
    fn.chat = vi.fn(() => 'mock-model');
    return fn;
  }),
}));

const mockGenerateObject = vi.fn();
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

const mockConfigService = {
  getOrThrow: vi.fn().mockReturnValue('test-openai-key'),
};

describe('IcpLlmService', () => {
  let service: IcpLlmService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IcpLlmService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<IcpLlmService>(IcpLlmService);
    vi.clearAllMocks();
  });

  it('throws BadRequestException when description is empty', async () => {
    await expect(service.compileDescription('')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.compileDescription('   ')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('calls generateObject and returns compiled filters', async () => {
    const compiled = {
      industries: ['saas'],
      technologiesAnyOf: ['salesforce'],
      employeeRanges: ['101,200'],
      personTitles: ['VP of Sales'],
      personSeniorities: ['vp'],
      locations: ['United States'],
    };
    mockGenerateObject.mockResolvedValue({ object: compiled });

    const result = await service.compileDescription(
      'SaaS companies using Salesforce, 100-200 employees, VP of Sales in USA',
    );

    expect(mockGenerateObject).toHaveBeenCalledOnce();
    expect(result).toEqual(compiled);
  });

  it('passes description as prompt to generateObject', async () => {
    mockGenerateObject.mockResolvedValue({ object: {} });
    const description = 'Fintech companies in Europe, 500+ employees';

    await service.compileDescription(description);

    const callArgs = mockGenerateObject.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(callArgs['prompt']).toBe(description);
  });

  it('propagates LLM errors to caller', async () => {
    mockGenerateObject.mockRejectedValue(new Error('OpenAI rate limit'));

    await expect(
      service.compileDescription('Target enterprise SaaS companies in USA'),
    ).rejects.toThrow('OpenAI rate limit');
  });

  it('returns empty filters object when LLM finds no matching fields', async () => {
    mockGenerateObject.mockResolvedValue({ object: {} });

    const result = await service.compileDescription(
      'Companies that are doing interesting things',
    );

    expect(result).toEqual({});
  });
});
