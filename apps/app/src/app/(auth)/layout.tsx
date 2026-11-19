import { Brand } from '@/components/brand';
import { ThemeToggle } from '@/components/theme-toggle';
import { Link2, ShieldCheck, Table2 } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-svh items-center justify-center bg-[radial-gradient(ellipse_at_top_left,var(--sidebar-accent),transparent_65%)] px-5 py-16 sm:px-8">
      <div className="absolute top-5 right-5">
        <ThemeToggle />
      </div>
      <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2 lg:gap-24">
        <div className="hidden space-y-8 lg:block">
          <Brand />
          <div>
            <p className="mb-3 text-xs font-medium tracking-widest text-muted-foreground uppercase">
              A place for your work
            </p>
            <h2 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">
              Your work,
              <br />
              <span className="text-muted-foreground">connected.</span>
            </h2>
            <p className="mt-5 max-w-sm text-base leading-relaxed text-muted-foreground">
              Keep records, people, and relationships in one organized workspace.
            </p>
          </div>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li className="flex items-center gap-3">
              <Table2 className="size-4 text-foreground/70" aria-hidden />
              Flexible records that fit your work
            </li>
            <li className="flex items-center gap-3">
              <Link2 className="size-4 text-foreground/70" aria-hidden />
              Connected information, always in context
            </li>
            <li className="flex items-center gap-3">
              <ShieldCheck className="size-4 text-foreground/70" aria-hidden />
              Access that follows your team
            </li>
          </ul>
        </div>
        <div className="mx-auto w-full max-w-sm space-y-7">
          <div className="flex justify-center lg:hidden">
            <Brand />
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
