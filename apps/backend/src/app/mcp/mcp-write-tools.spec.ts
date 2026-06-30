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

async function connect(prisma: unknown, scopes: string[]) {
  const server = buildMcpServer(prisma as never, { userId: 42, scopes });
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
