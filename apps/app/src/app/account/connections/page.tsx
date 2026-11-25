import { connection } from 'next/server';
import { PlugZap } from 'lucide-react';
import { Connections } from '@/components/account/connections';
import { Shell } from '@/components/dashboard/shell';

export default async function ConnectionsPage() {
  await connection();
  return (
    <Shell fill>
      <div className="flex shrink-0 items-center gap-3 px-4 py-5 sm:px-6">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-card shadow-xs">
          <PlugZap className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Connected apps</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Apps you have allowed to use Zuko on your behalf. They can only do what your role
            allows.
          </p>
        </div>
      </div>
      <Connections mcpUrl={`${process.env.FRONTEND_URL || 'http://localhost:4200'}/eve/v1/mcp`} />
    </Shell>
  );
}
