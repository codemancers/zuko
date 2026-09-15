import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildMcpServer } from './mcp-server';

function fakeDb(over: Record<string, unknown> = {}) {
  return {
    member: {
      findMany: vi.fn(async () => [{ organizationId: 1 }]),
    },
    task: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => ({
        id: 5,
        organizationId: 1,
        title: 'Existing',
        description: null,
        status: 'TODO',
        completedAt: null,
        assignee: null,
        owners: [],
        subtasks: [],
        parent: null,
      })),
      create: vi.fn(async () => ({
        id: 100,
        organizationId: 1,
        title: 'New Task',
        description: null,
        status: 'TODO',
        assignee: null,
        createdAt: new Date(),
      })),
      update: vi.fn(async () => ({
        id: 5,
        organizationId: 1,
        title: 'Existing',
        description: null,
        status: 'IN_PROGRESS',
        assignee: null,
        completedAt: null,
        updatedAt: new Date(),
      })),
    },
    ...over,
  } as never;
}

async function connect(prisma: unknown, scopes: string[], deps?: unknown) {
  const server = buildMcpServer(
    prisma as never,
    { userId: 42, scopes },
    deps as never,
  );
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  await server.connect(serverT);
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(clientT);
  return client;
}

const parse = (res: unknown) =>
  JSON.parse((res as { content: { text: string }[] }).content[0].text);

describe('list_organizations tool', () => {
  it('returns orgs with role', async () => {
    const db = fakeDb({
      member: {
        findMany: vi.fn(async () => [
          {
            role: 'owner',
            organization: { id: 1, name: 'Codemancers', slug: 'codemancers' },
          },
        ]),
      },
    });
    const client = await connect(db, ['organizations:read']);
    const res = await client.callTool({
      name: 'list_organizations',
      arguments: {},
    });
    const orgs = parse(res);
    expect(orgs).toEqual([
      { id: 1, name: 'Codemancers', slug: 'codemancers', role: 'owner' },
    ]);
  });

  it('rejects when token lacks organizations:read', async () => {
    const client = await connect(fakeDb(), ['tasks:read']);
    const res = (await client.callTool({
      name: 'list_organizations',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('list_tasks tool', () => {
  it('rejects when token lacks tasks:read', async () => {
    const client = await connect(fakeDb(), ['tasks:write']);
    const res = (await client.callTool({
      name: 'list_tasks',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('passes status filter to prisma', async () => {
    const findMany = vi.fn(async () => []);
    const client = await connect(fakeDb({ task: { findMany } }), [
      'tasks:read',
    ]);
    await client.callTool({
      name: 'list_tasks',
      arguments: { status: 'DONE' },
    });
    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.status).toBe('DONE');
  });

  it('passes organizationId filter to prisma', async () => {
    const findMany = vi.fn(async () => []);
    const client = await connect(fakeDb({ task: { findMany } }), [
      'tasks:read',
    ]);
    await client.callTool({
      name: 'list_tasks',
      arguments: { organizationId: 1 },
    });
    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.organizationId).toBe(1);
  });
});

describe('get_task tool', () => {
  it('rejects when token lacks tasks:read', async () => {
    const client = await connect(fakeDb(), ['tasks:write']);
    const res = (await client.callTool({
      name: 'get_task',
      arguments: { taskId: 5 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('returns task data when found', async () => {
    const client = await connect(fakeDb(), ['tasks:read']);
    const res = await client.callTool({
      name: 'get_task',
      arguments: { taskId: 5 },
    });
    const task = parse(res);
    expect(task.id).toBe(5);
  });

  it('returns error when task not found', async () => {
    const db = fakeDb({ task: { findFirst: vi.fn(async () => null) } });
    const client = await connect(db, ['tasks:read']);
    const res = (await client.callTool({
      name: 'get_task',
      arguments: { taskId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('create_task tool', () => {
  it('rejects when token lacks tasks:write', async () => {
    const client = await connect(fakeDb(), ['tasks:read']);
    const res = (await client.callTool({
      name: 'create_task',
      arguments: { title: 'New' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('auto-resolves org when user belongs to exactly one', async () => {
    const db = fakeDb();
    const client = await connect(db, ['tasks:write']);
    await client.callTool({ name: 'create_task', arguments: { title: 'New' } });
    expect(db.task.create).toHaveBeenCalledTimes(1);
    expect(db.task.create.mock.calls[0][0].data.organizationId).toBe(1);
  });

  it('errors when user belongs to no organization', async () => {
    const db = fakeDb({ member: { findMany: vi.fn(async () => []) } });
    const client = await connect(db, ['tasks:write']);
    const res = (await client.callTool({
      name: 'create_task',
      arguments: { title: 'New' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('errors when user belongs to multiple orgs and no organizationId given', async () => {
    const db = fakeDb({
      member: {
        findMany: vi.fn(async () => [
          { organizationId: 1 },
          { organizationId: 2 },
        ]),
      },
    });
    const client = await connect(db, ['tasks:write']);
    const res = (await client.callTool({
      name: 'create_task',
      arguments: { title: 'New' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('errors when specified organizationId not in user orgs', async () => {
    const client = await connect(fakeDb(), ['tasks:write']);
    const res = (await client.callTool({
      name: 'create_task',
      arguments: { title: 'New', organizationId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('update_task tool', () => {
  it('rejects when token lacks tasks:write', async () => {
    const client = await connect(fakeDb(), ['tasks:read']);
    const res = (await client.callTool({
      name: 'update_task',
      arguments: { taskId: 5, status: 'DONE' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('errors when task not found or inaccessible', async () => {
    const db = fakeDb({ task: { findFirst: vi.fn(async () => null) } });
    const client = await connect(db, ['tasks:write']);
    const res = (await client.callTool({
      name: 'update_task',
      arguments: { taskId: 99, status: 'DONE' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('delegates status update to prisma.task.update', async () => {
    const db = fakeDb();
    const client = await connect(db, ['tasks:write']);
    await client.callTool({
      name: 'update_task',
      arguments: { taskId: 5, status: 'IN_PROGRESS' },
    });
    expect(db.task.update).toHaveBeenCalledTimes(1);
    expect(db.task.update.mock.calls[0][0].data.status).toBe('IN_PROGRESS');
  });
});

function dealDb(over: Record<string, unknown> = {}) {
  return {
    member: { findMany: vi.fn(async () => [{ organizationId: 1 }]) },
    deal: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => ({ id: 7, organizationId: 1 })),
    },
    ...over,
  } as never;
}

function dealsSvc(over: Record<string, unknown> = {}) {
  return {
    deals: {
      create: vi.fn(async () => ({ id: 100, title: 'New Deal', value: null })),
      update: vi.fn(async () => ({ id: 7, title: 'Existing', value: null })),
      ...over,
    },
  };
}

function companyDb(over: Record<string, unknown> = {}) {
  return {
    member: { findMany: vi.fn(async () => [{ organizationId: 1 }]) },
    company: {
      findMany: vi.fn(async () => []),
      findFirst: vi.fn(async () => ({ id: 7, organizationId: 1 })),
    },
    ...over,
  } as never;
}

function companiesSvc(over: Record<string, unknown> = {}) {
  return {
    companies: {
      create: vi.fn(async () => ({ id: 100, companyName: 'New Co' })),
      update: vi.fn(async () => ({ id: 7, companyName: 'Existing Co' })),
      ...over,
    },
  };
}

describe('list_deals tool', () => {
  it('rejects when token lacks deals:read', async () => {
    const client = await connect(dealDb(), ['deals:write'], dealsSvc());
    const res = (await client.callTool({
      name: 'list_deals',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('passes stage and mine filters to prisma', async () => {
    const findMany = vi.fn(async () => []);
    const client = await connect(
      dealDb({
        member: { findMany: vi.fn(async () => [{ organizationId: 1 }]) },
        deal: { findMany },
      }),
      ['deals:read'],
      dealsSvc(),
    );
    await client.callTool({
      name: 'list_deals',
      arguments: { stage: 'proposal', mine: true },
    });
    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.stage).toBe('proposal');
    expect(where.owners).toEqual({ some: { userId: 42 } });
  });

  it('rejects an organizationId the user is not a member of', async () => {
    const client = await connect(dealDb(), ['deals:read'], dealsSvc());
    const res = (await client.callTool({
      name: 'list_deals',
      arguments: { organizationId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('get_deal tool', () => {
  it('returns error when deal not found', async () => {
    const db = dealDb({
      deal: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
    });
    const client = await connect(db, ['deals:read'], dealsSvc());
    const res = (await client.callTool({
      name: 'get_deal',
      arguments: { dealId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('create_deal tool', () => {
  it('rejects when token lacks deals:write', async () => {
    const client = await connect(dealDb(), ['deals:read'], dealsSvc());
    const res = (await client.callTool({
      name: 'create_deal',
      arguments: { title: 'New' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('auto-resolves org and calls DealsService.create with mcp source', async () => {
    const svc = dealsSvc();
    const client = await connect(dealDb(), ['deals:write'], svc);
    await client.callTool({ name: 'create_deal', arguments: { title: 'New' } });
    expect(svc.deals.create).toHaveBeenCalledTimes(1);
    const [input, actorId, source] = svc.deals.create.mock.calls[0];
    expect(input.organizationId).toBe(1);
    expect(actorId).toBe(42);
    expect(source).toBe('mcp');
  });

  it('surfaces service validation errors', async () => {
    const svc = dealsSvc({
      create: vi.fn(async () => {
        throw new Error('Invalid deal stage: bogus');
      }),
    });
    const client = await connect(dealDb(), ['deals:write'], svc);
    const res = (await client.callTool({
      name: 'create_deal',
      arguments: { title: 'New' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('update_deal tool', () => {
  it('errors when deal not found or inaccessible', async () => {
    const db = dealDb({
      deal: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
    });
    const client = await connect(db, ['deals:write'], dealsSvc());
    const res = (await client.callTool({
      name: 'update_deal',
      arguments: { dealId: 99, stage: 'closed_won' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('delegates to DealsService.update with the resolved org id', async () => {
    const svc = dealsSvc();
    const client = await connect(dealDb(), ['deals:write'], svc);
    await client.callTool({
      name: 'update_deal',
      arguments: { dealId: 7, stage: 'negotiation' },
    });
    expect(svc.deals.update).toHaveBeenCalledTimes(1);
    const [dealId, orgId, input, actorId, source] =
      svc.deals.update.mock.calls[0];
    expect(dealId).toBe(7);
    expect(orgId).toBe(1);
    expect(input.stage).toBe('negotiation');
    expect(actorId).toBe(42);
    expect(source).toBe('mcp');
  });
});

describe('list_companies tool', () => {
  it('rejects when token lacks companies:read', async () => {
    const client = await connect(
      companyDb(),
      ['companies:write'],
      companiesSvc(),
    );
    const res = (await client.callTool({
      name: 'list_companies',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('passes search and mine filters to prisma', async () => {
    const findMany = vi.fn(async () => []);
    const client = await connect(
      companyDb({
        member: { findMany: vi.fn(async () => [{ organizationId: 1 }]) },
        company: { findMany },
      }),
      ['companies:read'],
      companiesSvc(),
    );
    await client.callTool({
      name: 'list_companies',
      arguments: { search: 'acme', mine: true },
    });
    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.OR).toBeDefined();
    expect(where.owners).toEqual({ some: { userId: 42 } });
  });

  it('rejects an organizationId the user is not a member of', async () => {
    const client = await connect(
      companyDb(),
      ['companies:read'],
      companiesSvc(),
    );
    const res = (await client.callTool({
      name: 'list_companies',
      arguments: { organizationId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('get_company tool', () => {
  it('returns error when company not found', async () => {
    const db = companyDb({
      company: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
    });
    const client = await connect(db, ['companies:read'], companiesSvc());
    const res = (await client.callTool({
      name: 'get_company',
      arguments: { companyId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('create_company tool', () => {
  it('rejects when token lacks companies:write', async () => {
    const client = await connect(
      companyDb(),
      ['companies:read'],
      companiesSvc(),
    );
    const res = (await client.callTool({
      name: 'create_company',
      arguments: { companyName: 'New Co' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('auto-resolves org and calls CompaniesService.create with mcp source', async () => {
    const svc = companiesSvc();
    const client = await connect(companyDb(), ['companies:write'], svc);
    await client.callTool({
      name: 'create_company',
      arguments: { companyName: 'New Co' },
    });
    expect(svc.companies.create).toHaveBeenCalledTimes(1);
    const [input, actorId, source] = svc.companies.create.mock.calls[0];
    expect(input.organizationId).toBe(1);
    expect(actorId).toBe(42);
    expect(source).toBe('mcp');
  });

  it('surfaces service validation errors', async () => {
    const svc = companiesSvc({
      create: vi.fn(async () => {
        throw new Error('Company name is required');
      }),
    });
    const client = await connect(companyDb(), ['companies:write'], svc);
    const res = (await client.callTool({
      name: 'create_company',
      arguments: { companyName: '' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('update_company tool', () => {
  it('errors when company not found or inaccessible', async () => {
    const db = companyDb({
      company: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
    });
    const client = await connect(db, ['companies:write'], companiesSvc());
    const res = (await client.callTool({
      name: 'update_company',
      arguments: { companyId: 99, companyName: 'Renamed' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('delegates to CompaniesService.update with the resolved org id', async () => {
    const svc = companiesSvc();
    const client = await connect(companyDb(), ['companies:write'], svc);
    await client.callTool({
      name: 'update_company',
      arguments: { companyId: 7, website: 'https://acme.example.com' },
    });
    expect(svc.companies.update).toHaveBeenCalledTimes(1);
    const [companyId, orgId, input, actorId, source] =
      svc.companies.update.mock.calls[0];
    expect(companyId).toBe(7);
    expect(orgId).toBe(1);
    expect(input.website).toBe('https://acme.example.com');
    expect(actorId).toBe(42);
    expect(source).toBe('mcp');
  });
});
