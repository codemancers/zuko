import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { WorkflowController } from '@workflow/nest';
import { WorkflowHttpGuard } from './workflow-http.guard';

function context(controller: unknown, type = 'http') {
  return { getType: () => type, getClass: () => controller } as unknown as ExecutionContext;
}

describe('private workflow execution', () => {
  const guard = new WorkflowHttpGuard();

  it('rejects HTTP access to the SDK controller regardless of caller credentials', () => {
    expect(() => guard.canActivate(context(WorkflowController))).toThrow(NotFoundException);
  });

  it('leaves application controllers and non-HTTP execution alone', () => {
    expect(guard.canActivate(context(class ApplicationController {}))).toBe(true);
    expect(guard.canActivate(context(WorkflowController, 'rpc'))).toBe(true);
  });
});
