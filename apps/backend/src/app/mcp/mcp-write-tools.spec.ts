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

const SAMPLE_SUMMARY = {
  blocks: [{ type: 'paragraph', data: { text: 'hello' } }],
};

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

function contactDb(over: Record<string, unknown> = {}) {
  return {
    member: { findMany: vi.fn(async () => [{ organizationId: 1 }]) },
    contact: {
      findFirst: vi.fn(async () => ({ id: 7, organizationId: 1 })),
    },
    ...over,
  } as never;
}

function contactsSvc(over: Record<string, unknown> = {}) {
  return {
    contacts: {
      findAll: vi.fn(async () => ({ contacts: [], total: 0 })),
      create: vi.fn(async () => ({ id: 100, name: 'New Contact' })),
      update: vi.fn(async () => ({ id: 7, name: 'Existing Contact' })),
      ...over,
    },
  };
}

describe('list_contacts tool', () => {
  it('rejects when token lacks contacts:read', async () => {
    const client = await connect(
      contactDb(),
      ['contacts:write'],
      contactsSvc(),
    );
    const res = (await client.callTool({
      name: 'list_contacts',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('auto-resolves org when user belongs to exactly one', async () => {
    const svc = contactsSvc();
    const client = await connect(contactDb(), ['contacts:read'], svc);
    await client.callTool({ name: 'list_contacts', arguments: {} });
    expect(svc.contacts.findAll).toHaveBeenCalledTimes(1);
    expect(svc.contacts.findAll.mock.calls[0][0].organizationId).toBe(1);
  });

  it('errors when user belongs to multiple orgs and no organizationId given', async () => {
    const db = contactDb({
      member: {
        findMany: vi.fn(async () => [
          { organizationId: 1 },
          { organizationId: 2 },
        ]),
      },
    });
    const client = await connect(db, ['contacts:read'], contactsSvc());
    const res = (await client.callTool({
      name: 'list_contacts',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('rejects an organizationId the user is not a member of', async () => {
    const client = await connect(contactDb(), ['contacts:read'], contactsSvc());
    const res = (await client.callTool({
      name: 'list_contacts',
      arguments: { organizationId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('get_contact tool', () => {
  it('returns error when contact not found', async () => {
    const db = contactDb({ contact: { findFirst: vi.fn(async () => null) } });
    const client = await connect(db, ['contacts:read'], contactsSvc());
    const res = (await client.callTool({
      name: 'get_contact',
      arguments: { contactId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('returns contact data when found', async () => {
    const client = await connect(contactDb(), ['contacts:read'], contactsSvc());
    const res = await client.callTool({
      name: 'get_contact',
      arguments: { contactId: 7 },
    });
    const contact = parse(res);
    expect(contact.id).toBe(7);
  });
});

describe('create_contact tool', () => {
  it('rejects when token lacks contacts:write', async () => {
    const client = await connect(contactDb(), ['contacts:read'], contactsSvc());
    const res = (await client.callTool({
      name: 'create_contact',
      arguments: { name: 'New Contact' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('auto-resolves org and calls ContactsService.create with mcp source', async () => {
    const svc = contactsSvc();
    const client = await connect(contactDb(), ['contacts:write'], svc);
    await client.callTool({
      name: 'create_contact',
      arguments: { name: 'New Contact' },
    });
    expect(svc.contacts.create).toHaveBeenCalledTimes(1);
    const [input, actorId, source] = svc.contacts.create.mock.calls[0];
    expect(input.organizationId).toBe(1);
    expect(actorId).toBe(42);
    expect(source).toBe('mcp');
  });

  it('surfaces service validation errors', async () => {
    const svc = contactsSvc({
      create: vi.fn(async () => {
        throw new Error('A contact with email x@y.com already exists');
      }),
    });
    const client = await connect(contactDb(), ['contacts:write'], svc);
    const res = (await client.callTool({
      name: 'create_contact',
      arguments: { name: 'New Contact', email: 'x@y.com' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('update_contact tool', () => {
  it('errors when contact not found or inaccessible', async () => {
    const db = contactDb({ contact: { findFirst: vi.fn(async () => null) } });
    const client = await connect(db, ['contacts:write'], contactsSvc());
    const res = (await client.callTool({
      name: 'update_contact',
      arguments: { contactId: 99, name: 'Renamed' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('delegates to ContactsService.update with the resolved org id', async () => {
    const svc = contactsSvc();
    const client = await connect(contactDb(), ['contacts:write'], svc);
    await client.callTool({
      name: 'update_contact',
      arguments: { contactId: 7, phone: '+14155552671' },
    });
    expect(svc.contacts.update).toHaveBeenCalledTimes(1);
    const [contactId, orgId, input, actorId, source] =
      svc.contacts.update.mock.calls[0];
    expect(contactId).toBe(7);
    expect(orgId).toBe(1);
    expect(input.phone).toBe('+14155552671');
    expect(actorId).toBe(42);
    expect(source).toBe('mcp');
  });
});

function icpDb(over: Record<string, unknown> = {}) {
  return {
    member: { findMany: vi.fn(async () => [{ organizationId: 1 }]) },
    icpProfile: {
      findFirst: vi.fn(async () => ({ id: 7, organizationId: 1 })),
    },
    ...over,
  } as never;
}

function icpsSvc(over: Record<string, unknown> = {}) {
  return {
    icps: {
      findAll: vi.fn(async () => ({ data: [], total: 0 })),
      findById: vi.fn(async () => ({ id: 7, name: 'Existing ICP' })),
      create: vi.fn(async () => ({ id: 100, name: 'New ICP' })),
      update: vi.fn(async () => ({ id: 7, name: 'Existing ICP' })),
      delete: vi.fn(async () => ({ id: 7 })),
      ...over,
    },
  };
}

describe('list_icp_profiles tool', () => {
  it('rejects when token lacks icps:read', async () => {
    const client = await connect(icpDb(), ['icps:write'], icpsSvc());
    const res = (await client.callTool({
      name: 'list_icp_profiles',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('auto-resolves org when user belongs to exactly one', async () => {
    const svc = icpsSvc();
    const client = await connect(icpDb(), ['icps:read'], svc);
    await client.callTool({ name: 'list_icp_profiles', arguments: {} });
    expect(svc.icps.findAll).toHaveBeenCalledTimes(1);
    expect(svc.icps.findAll.mock.calls[0][0]).toBe(1);
  });

  it('errors when user belongs to multiple orgs and no organizationId given', async () => {
    const db = icpDb({
      member: {
        findMany: vi.fn(async () => [
          { organizationId: 1 },
          { organizationId: 2 },
        ]),
      },
    });
    const client = await connect(db, ['icps:read'], icpsSvc());
    const res = (await client.callTool({
      name: 'list_icp_profiles',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('get_icp_profile tool', () => {
  it('errors when ICP profile not found or inaccessible', async () => {
    const db = icpDb({
      icpProfile: { findFirst: vi.fn(async () => null) },
    });
    const client = await connect(db, ['icps:read'], icpsSvc());
    const res = (await client.callTool({
      name: 'get_icp_profile',
      arguments: { icpId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('returns profile data when found', async () => {
    const client = await connect(icpDb(), ['icps:read'], icpsSvc());
    const res = await client.callTool({
      name: 'get_icp_profile',
      arguments: { icpId: 7 },
    });
    const profile = parse(res);
    expect(profile.id).toBe(7);
  });
});

describe('create_icp_profile tool', () => {
  it('rejects when token lacks icps:write', async () => {
    const client = await connect(icpDb(), ['icps:read'], icpsSvc());
    const res = (await client.callTool({
      name: 'create_icp_profile',
      arguments: { name: 'New ICP' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('auto-resolves org and calls IcpService.create', async () => {
    const svc = icpsSvc();
    const client = await connect(icpDb(), ['icps:write'], svc);
    await client.callTool({
      name: 'create_icp_profile',
      arguments: { name: 'New ICP', filters: { industries: ['saas'] } },
    });
    expect(svc.icps.create).toHaveBeenCalledTimes(1);
    const [orgId, dto] = svc.icps.create.mock.calls[0];
    expect(orgId).toBe(1);
    expect(dto.name).toBe('New ICP');
    expect(dto.filters).toEqual({ industries: ['saas'] });
  });

  it('surfaces service validation errors', async () => {
    const svc = icpsSvc({
      create: vi.fn(async () => {
        throw new Error('Name is required');
      }),
    });
    const client = await connect(icpDb(), ['icps:write'], svc);
    const res = (await client.callTool({
      name: 'create_icp_profile',
      arguments: { name: '' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('update_icp_profile tool', () => {
  it('errors when ICP profile not found or inaccessible', async () => {
    const db = icpDb({
      icpProfile: { findFirst: vi.fn(async () => null) },
    });
    const client = await connect(db, ['icps:write'], icpsSvc());
    const res = (await client.callTool({
      name: 'update_icp_profile',
      arguments: { icpId: 99, name: 'Renamed' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('delegates to IcpService.update with the resolved org id', async () => {
    const svc = icpsSvc();
    const client = await connect(icpDb(), ['icps:write'], svc);
    await client.callTool({
      name: 'update_icp_profile',
      arguments: { icpId: 7, filters: { employeeRanges: ['50,200'] } },
    });
    expect(svc.icps.update).toHaveBeenCalledTimes(1);
    const [icpId, orgId, dto] = svc.icps.update.mock.calls[0];
    expect(icpId).toBe(7);
    expect(orgId).toBe(1);
    expect(dto.filters).toEqual({ employeeRanges: ['50,200'] });
  });
});

describe('delete_icp_profile tool', () => {
  it('rejects when token lacks icps:write', async () => {
    const client = await connect(icpDb(), ['icps:read'], icpsSvc());
    const res = (await client.callTool({
      name: 'delete_icp_profile',
      arguments: { icpId: 7 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('errors when ICP profile not found or inaccessible', async () => {
    const db = icpDb({
      icpProfile: { findFirst: vi.fn(async () => null) },
    });
    const client = await connect(db, ['icps:write'], icpsSvc());
    const res = (await client.callTool({
      name: 'delete_icp_profile',
      arguments: { icpId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('delegates to IcpService.delete with the resolved org id', async () => {
    const svc = icpsSvc();
    const client = await connect(icpDb(), ['icps:write'], svc);
    const res = await client.callTool({
      name: 'delete_icp_profile',
      arguments: { icpId: 7 },
    });
    expect(svc.icps.delete).toHaveBeenCalledTimes(1);
    expect(svc.icps.delete.mock.calls[0]).toEqual([7, 1]);
    expect(parse(res)).toEqual({ deleted: true, icpId: 7 });
  });
});

function leadDb(over: Record<string, unknown> = {}) {
  return {
    member: { findMany: vi.fn(async () => [{ organizationId: 1 }]) },
    lead: {
      findFirst: vi.fn(async () => ({ id: 7, organizationId: 1 })),
    },
    ...over,
  } as never;
}

function leadsSvc(over: Record<string, unknown> = {}) {
  return {
    leads: {
      findAll: vi.fn(async () => ({ data: [], total: 0 })),
      findById: vi.fn(async () => ({ id: 7, name: 'Existing Lead' })),
      create: vi.fn(async () => ({ id: 100, name: 'New Lead' })),
      update: vi.fn(async () => ({ id: 7, name: 'Existing Lead' })),
      delete: vi.fn(async () => ({ id: 7 })),
      convert: vi.fn(async () => ({ id: 7, dealId: 55 })),
      revert: vi.fn(async () => ({ id: 7, status: 'replied' })),
      ...over,
    },
  };
}

describe('list_leads tool', () => {
  it('rejects when token lacks leads:read', async () => {
    const client = await connect(leadDb(), ['leads:write'], leadsSvc());
    const res = (await client.callTool({
      name: 'list_leads',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('auto-resolves org when user belongs to exactly one', async () => {
    const svc = leadsSvc();
    const client = await connect(leadDb(), ['leads:read'], svc);
    await client.callTool({ name: 'list_leads', arguments: {} });
    expect(svc.leads.findAll).toHaveBeenCalledTimes(1);
    expect(svc.leads.findAll.mock.calls[0][0]).toBe(1);
  });

  it('errors when user belongs to multiple orgs and no organizationId given', async () => {
    const db = leadDb({
      member: {
        findMany: vi.fn(async () => [
          { organizationId: 1 },
          { organizationId: 2 },
        ]),
      },
    });
    const client = await connect(db, ['leads:read'], leadsSvc());
    const res = (await client.callTool({
      name: 'list_leads',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('get_lead tool', () => {
  it('errors when lead not found or inaccessible', async () => {
    const db = leadDb({ lead: { findFirst: vi.fn(async () => null) } });
    const client = await connect(db, ['leads:read'], leadsSvc());
    const res = (await client.callTool({
      name: 'get_lead',
      arguments: { leadId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('returns lead data when found', async () => {
    const client = await connect(leadDb(), ['leads:read'], leadsSvc());
    const res = await client.callTool({
      name: 'get_lead',
      arguments: { leadId: 7 },
    });
    const lead = parse(res);
    expect(lead.id).toBe(7);
  });
});

describe('create_lead tool', () => {
  it('rejects when token lacks leads:write', async () => {
    const client = await connect(leadDb(), ['leads:read'], leadsSvc());
    const res = (await client.callTool({
      name: 'create_lead',
      arguments: { icpProfileId: 1, name: 'New Lead' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('auto-resolves org and calls LeadsService.create', async () => {
    const svc = leadsSvc();
    const client = await connect(leadDb(), ['leads:write'], svc);
    await client.callTool({
      name: 'create_lead',
      arguments: { icpProfileId: 1, name: 'New Lead' },
    });
    expect(svc.leads.create).toHaveBeenCalledTimes(1);
    const [orgId, dto] = svc.leads.create.mock.calls[0];
    expect(orgId).toBe(1);
    expect(dto.name).toBe('New Lead');
    expect(dto.organizationId).toBeUndefined();
  });

  it('surfaces service validation errors', async () => {
    const svc = leadsSvc({
      create: vi.fn(async () => {
        throw new Error('Name is required');
      }),
    });
    const client = await connect(leadDb(), ['leads:write'], svc);
    const res = (await client.callTool({
      name: 'create_lead',
      arguments: { icpProfileId: 1, name: '' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('update_lead tool', () => {
  it('errors when lead not found or inaccessible', async () => {
    const db = leadDb({ lead: { findFirst: vi.fn(async () => null) } });
    const client = await connect(db, ['leads:write'], leadsSvc());
    const res = (await client.callTool({
      name: 'update_lead',
      arguments: { leadId: 99, name: 'Renamed' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('delegates to LeadsService.update with the resolved org id', async () => {
    const svc = leadsSvc();
    const client = await connect(leadDb(), ['leads:write'], svc);
    await client.callTool({
      name: 'update_lead',
      arguments: { leadId: 7, status: 'interested' },
    });
    expect(svc.leads.update).toHaveBeenCalledTimes(1);
    const [leadId, orgId, dto] = svc.leads.update.mock.calls[0];
    expect(leadId).toBe(7);
    expect(orgId).toBe(1);
    expect(dto.status).toBe('interested');
  });
});

describe('delete_lead tool', () => {
  it('rejects when token lacks leads:write', async () => {
    const client = await connect(leadDb(), ['leads:read'], leadsSvc());
    const res = (await client.callTool({
      name: 'delete_lead',
      arguments: { leadId: 7 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('delegates to LeadsService.delete with the resolved org id', async () => {
    const svc = leadsSvc();
    const client = await connect(leadDb(), ['leads:write'], svc);
    const res = await client.callTool({
      name: 'delete_lead',
      arguments: { leadId: 7 },
    });
    expect(svc.leads.delete).toHaveBeenCalledTimes(1);
    expect(svc.leads.delete.mock.calls[0]).toEqual([7, 1]);
    expect(parse(res)).toEqual({ deleted: true, leadId: 7 });
  });
});

describe('convert_lead tool', () => {
  it('errors when lead not found or inaccessible', async () => {
    const db = leadDb({ lead: { findFirst: vi.fn(async () => null) } });
    const client = await connect(db, ['leads:write'], leadsSvc());
    const res = (await client.callTool({
      name: 'convert_lead',
      arguments: { leadId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('delegates to LeadsService.convert with the resolved org id', async () => {
    const svc = leadsSvc();
    const client = await connect(leadDb(), ['leads:write'], svc);
    const res = await client.callTool({
      name: 'convert_lead',
      arguments: { leadId: 7 },
    });
    expect(svc.leads.convert).toHaveBeenCalledTimes(1);
    expect(svc.leads.convert.mock.calls[0]).toEqual([7, 1]);
    expect(parse(res)).toEqual({ id: 7, dealId: 55 });
  });
});

describe('revert_lead tool', () => {
  it('delegates to LeadsService.revert with the resolved org id', async () => {
    const svc = leadsSvc();
    const client = await connect(leadDb(), ['leads:write'], svc);
    const res = await client.callTool({
      name: 'revert_lead',
      arguments: { leadId: 7 },
    });
    expect(svc.leads.revert).toHaveBeenCalledTimes(1);
    expect(svc.leads.revert.mock.calls[0]).toEqual([7, 1]);
    expect(parse(res)).toEqual({ id: 7, status: 'replied' });
  });
});

function campaignDb(over: Record<string, unknown> = {}) {
  return {
    member: { findMany: vi.fn(async () => [{ organizationId: 1 }]) },
    campaign: {
      findFirst: vi.fn(async () => ({ id: 7, organizationId: 1 })),
    },
    ...over,
  } as never;
}

function campaignsSvc(over: Record<string, unknown> = {}) {
  return {
    campaigns: {
      getAllCampaigns: vi.fn(async () => []),
      getCampaignsByIcpProfile: vi.fn(async () => []),
      getZukoCampaignById: vi.fn(async () => ({
        id: 7,
        name: 'Existing Campaign',
      })),
      createCampaignMeta: vi.fn(async () => ({
        id: 100,
        name: 'New Campaign',
      })),
      ...over,
    },
  };
}

describe('list_campaigns tool', () => {
  it('rejects when token lacks campaigns:read', async () => {
    const client = await connect(
      campaignDb(),
      ['campaigns:write'],
      campaignsSvc(),
    );
    const res = (await client.callTool({
      name: 'list_campaigns',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('auto-resolves org and calls getAllCampaigns when no icpProfileId given', async () => {
    const svc = campaignsSvc();
    const client = await connect(campaignDb(), ['campaigns:read'], svc);
    await client.callTool({ name: 'list_campaigns', arguments: {} });
    expect(svc.campaigns.getAllCampaigns).toHaveBeenCalledWith(1);
    expect(svc.campaigns.getCampaignsByIcpProfile).not.toHaveBeenCalled();
  });

  it('calls getCampaignsByIcpProfile when icpProfileId given', async () => {
    const svc = campaignsSvc();
    const client = await connect(campaignDb(), ['campaigns:read'], svc);
    await client.callTool({
      name: 'list_campaigns',
      arguments: { icpProfileId: 5 },
    });
    expect(svc.campaigns.getCampaignsByIcpProfile).toHaveBeenCalledWith(1, 5);
  });

  it('errors when user belongs to multiple orgs and no organizationId given', async () => {
    const db = campaignDb({
      member: {
        findMany: vi.fn(async () => [
          { organizationId: 1 },
          { organizationId: 2 },
        ]),
      },
    });
    const client = await connect(db, ['campaigns:read'], campaignsSvc());
    const res = (await client.callTool({
      name: 'list_campaigns',
      arguments: {},
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('get_campaign tool', () => {
  it('errors when campaign not found or inaccessible', async () => {
    const db = campaignDb({
      campaign: { findFirst: vi.fn(async () => null) },
    });
    const client = await connect(db, ['campaigns:read'], campaignsSvc());
    const res = (await client.callTool({
      name: 'get_campaign',
      arguments: { campaignId: 99 },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('returns campaign data when found', async () => {
    const client = await connect(
      campaignDb(),
      ['campaigns:read'],
      campaignsSvc(),
    );
    const res = await client.callTool({
      name: 'get_campaign',
      arguments: { campaignId: 7 },
    });
    const campaign = parse(res);
    expect(campaign.id).toBe(7);
  });
});

describe('create_campaign tool', () => {
  it('rejects when token lacks campaigns:write', async () => {
    const client = await connect(
      campaignDb(),
      ['campaigns:read'],
      campaignsSvc(),
    );
    const res = (await client.callTool({
      name: 'create_campaign',
      arguments: { name: 'New Campaign' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('auto-resolves org and calls createCampaignMeta with the authorized user id', async () => {
    const svc = campaignsSvc();
    const client = await connect(campaignDb(), ['campaigns:write'], svc);
    await client.callTool({
      name: 'create_campaign',
      arguments: { name: 'New Campaign', icpProfileId: 3 },
    });
    expect(svc.campaigns.createCampaignMeta).toHaveBeenCalledTimes(1);
    const [orgId, userId, dto] = svc.campaigns.createCampaignMeta.mock.calls[0];
    expect(orgId).toBe(1);
    expect(userId).toBe(42);
    expect(dto).toEqual({ name: 'New Campaign', icpProfileId: 3 });
  });

  it('surfaces service errors', async () => {
    const svc = campaignsSvc({
      createCampaignMeta: vi.fn(async () => {
        throw new Error('Name is required');
      }),
    });
    const client = await connect(campaignDb(), ['campaigns:write'], svc);
    const res = (await client.callTool({
      name: 'create_campaign',
      arguments: { name: '' },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});

describe('update_company_summary tool', () => {
  it('rejects when token lacks companies:write', async () => {
    const client = await connect(
      companyDb(),
      ['companies:read'],
      companiesSvc(),
    );
    const res = (await client.callTool({
      name: 'update_company_summary',
      arguments: { companyId: 7, summary: SAMPLE_SUMMARY },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('errors when company not found or inaccessible', async () => {
    const db = companyDb({
      company: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
      },
    });
    const client = await connect(db, ['companies:write'], companiesSvc());
    const res = (await client.callTool({
      name: 'update_company_summary',
      arguments: { companyId: 99, summary: SAMPLE_SUMMARY },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });

  it('delegates to CompaniesService.update with the resolved org id and full summary', async () => {
    const svc = companiesSvc();
    const client = await connect(companyDb(), ['companies:write'], svc);
    await client.callTool({
      name: 'update_company_summary',
      arguments: { companyId: 7, summary: SAMPLE_SUMMARY },
    });
    expect(svc.companies.update).toHaveBeenCalledTimes(1);
    const [companyId, orgId, input, actorId, source] =
      svc.companies.update.mock.calls[0];
    expect(companyId).toBe(7);
    expect(orgId).toBe(1);
    expect(input.summary).toEqual(SAMPLE_SUMMARY);
    expect(actorId).toBe(42);
    expect(source).toBe('mcp');
  });

  it('surfaces service validation errors', async () => {
    const svc = companiesSvc({
      update: vi.fn(async () => {
        throw new Error('Company not found');
      }),
    });
    const client = await connect(companyDb(), ['companies:write'], svc);
    const res = (await client.callTool({
      name: 'update_company_summary',
      arguments: { companyId: 7, summary: SAMPLE_SUMMARY },
    })) as { isError?: boolean };
    expect(res.isError).toBe(true);
  });
});
