/**
 * Characterization tests for #7361 (task date semantics): what the HTTP layer
 * does with completedAt today. See docs/technical/task-date-semantics-7361.md.
 */
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Test } from '@nestjs/testing';
import {
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { TaskService } from '@zuko/sales';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { TasksController } from './tasks.controller';

describe('Task completedAt over HTTP', () => {
  let app: INestApplication;
  let url: string;
  const service = {
    createTask: vi.fn(async (_org, dto) => ({ id: 1, ...dto })),
    updateTask: vi.fn(async (_org, id, dto) => ({ id, ...dto })),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TaskService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OrganizationGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.organizationId = 7;
          req.user = { id: '11' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    // Same pipe options as main.ts.
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, forbidUnknownValues: false }),
    );
    await app.listen(0, '127.0.0.1');
    url = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const patch = (body: object) =>
    fetch(`${url}/tasks/1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it.each([
    '2026-11-02T18:30:00.000Z',
    '2026-11-03',
    '2026-11-03T00:00:00+05:30',
    'not-a-date',
  ])(
    'passes completedAt %j to the service as the raw string (no Date, no validation)',
    async (completedAt) => {
      const response = await patch({ completedAt });
      expect(response.status).toBe(200);
      const [, , dto, actorId] = service.updateTask.mock.calls[0];
      expect(dto.completedAt).toBe(completedAt);
      expect(typeof dto.completedAt).toBe('string');
      expect(actorId).toBe(11);
    },
  );

  it('passes completedAt null through to clear it', async () => {
    const response = await patch({ completedAt: null });
    expect(response.status).toBe(200);
    expect(service.updateTask.mock.calls[0][2].completedAt).toBeNull();
  });

  it('attributes creation to the session user as both owner and actor', async () => {
    const response = await fetch(`${url}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Call Asha' }),
    });
    expect(response.status).toBe(201);
    const [orgId, dto, actorId] = service.createTask.mock.calls[0];
    expect(orgId).toBe(7);
    expect(dto.createdByUserId).toBe(11);
    expect(actorId).toBe(11);
  });
});
