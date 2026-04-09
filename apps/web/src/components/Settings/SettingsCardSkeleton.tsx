export function SettingsCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-200/70 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-zinc-200 dark:bg-zinc-700"></div>
          <div className="space-y-2">
            <div className="h-5 w-24 rounded bg-zinc-200 dark:bg-zinc-700"></div>
            <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-700"></div>
          </div>
        </div>
        <div className="h-8 w-20 rounded bg-zinc-200 dark:bg-zinc-700"></div>
      </div>
    </div>
  );
}
