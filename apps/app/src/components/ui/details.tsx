import type { ReactNode } from 'react';

export function DetailsList({ children }: { children: ReactNode }) {
  return <dl className="max-w-xl space-y-6">{children}</dl>;
}

export function DetailLabel({
  children,
  accessory,
}: {
  children: ReactNode;
  accessory?: ReactNode;
}) {
  return (
    <dt className="flex h-5 items-center gap-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
      {children}
      {accessory}
    </dt>
  );
}

export function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <DetailLabel>{label}</DetailLabel>
      <dd className="min-h-8 py-1 text-sm break-words">{children}</dd>
    </div>
  );
}
