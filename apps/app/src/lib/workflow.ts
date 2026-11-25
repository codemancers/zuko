import 'server-only';
import { createWorld } from '@workflow/world-postgres';
import { setWorld } from 'workflow/runtime';
import { getRun } from 'workflow/api';

let world: ReturnType<typeof createWorld> | undefined;

/** Next.js consumes durable streams; only the NestJS backend executes jobs. */
export function setupRun(runId: string) {
  const connectionString = process.env.WORKFLOW_POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Workflow storage is not configured');
  world ??= createWorld({ connectionString, skipWorkers: true });
  setWorld(world);
  return getRun(runId);
}
