import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { WorkflowModule } from '@workflow/nest';
import { getWorld } from 'workflow/runtime';
import type { createWorld } from '@workflow/world-postgres';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WorkflowHttpGuard } from './workflow-http.guard';

@Module({
  imports: [
    WorkflowModule.forRootAsync({
      useFactory: async () => {
        process.env.WORKFLOW_TARGET_WORLD = '@workflow/world-postgres';
        const outDir = join(__dirname, 'workflows');
        // Register private delivery before the module starts the Postgres workers.
        // Preserve native import so webpack does not rewrite the generated bundle URL.
        const load = new Function('url', 'return import(url)') as (
          url: string,
        ) => Promise<{ POST: (request: Request) => Promise<Response> }>;
        const bundle = await load(pathToFileURL(join(outDir, 'workflows.mjs')).href);
        const world = (await getWorld()) as ReturnType<typeof createWorld>;
        const namespace = process.env.WORKFLOW_QUEUE_NAMESPACE;
        world.registerHandler(
          namespace ? `__${namespace}_wkf_workflow_` : '__wkf_workflow_',
          bundle.POST,
        );
        return {
          workingDir: __dirname,
          outDir,
          dirs: ['src/workflows'],
          basePath: '/api',
          skipBuild: true,
          preloadBundles: false, // The private delivery handler already loaded the bundles.
          manageWorldLifecycle: true,
        };
      },
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: WorkflowHttpGuard }],

})
export class WorkflowRuntimeModule {}
