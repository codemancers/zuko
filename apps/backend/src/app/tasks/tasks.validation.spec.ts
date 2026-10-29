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
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { AuthGuard } from '@thallesp/nestjs-better-auth';
import { TaskService } from '@zuko/sales';
import { OrganizationGuard } from '../../common/auth/organization.guard';
import { TasksController } from './tasks.controller';

describe('Task isSales HTTP validation', () => {
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
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.organizationId = 7;
          req.user = { id: '11' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    // Match main.ts: exercise the actual controller metadata and HTTP pipe,
    // not direct controller calls that bypass request validation.
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

  for (const method of ['POST', 'PATCH'] as const) {
    describe(method, () => {
      const invoke = (body: object) =>
        fetch(`${url}/tasks${method === 'PATCH' ? '/1' : ''}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      const mock = method === 'POST' ? service.createTask : service.updateTask;

      it.each(
        ['true', 'false', 1, 0, null, {}, []].map((value) => ({ value })),
      )(
        'rejects nonboolean $value before calling service',
        async ({ value: isSales }) => {
          const response = await invoke({
            title: 'Keep existing fields',
            isSales,
          });
          const body = await response.json();
          expect(response.status).toBe(400);
          expect(body.message).toContain('isSales must be a boolean value');
          expect(mock).not.toHaveBeenCalled();
        },
      );

      it.each([true, false])(
        'accepts boolean %j without coercion',
        async (isSales) => {
          const response = await invoke({
            title: 'Keep existing fields',
            isSales,
          });
          expect(response.status).toBe(method === 'POST' ? 201 : 200);
          expect(await response.json()).toMatchObject({
            title: 'Keep existing fields',
            isSales,
          });
          const args = mock.mock.calls[0];
          expect(args[0]).toBe(7);
          expect(args[args.length - 1]).toBe(11);
        },
      );

      it('allows omission without supplying a false default on update', async () => {
        const response = await invoke({ title: 'Title-only change' });
        expect(response.status).toBe(method === 'POST' ? 201 : 200);
        const body = await response.json();
        expect(body.title).toBe('Title-only change');
        expect(body).not.toHaveProperty('isSales');
        expect(mock).toHaveBeenCalledOnce();
      });
    });
  }
});
