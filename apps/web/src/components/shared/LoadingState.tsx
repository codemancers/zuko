import { Spinner } from '@zuko/ui-kit';

interface LoadingStateProps {
  message?: string;
}

/**
 * The single loading state for page and panel bodies. Every caller gets the
 * same vertical space, so a view does not jump when it resolves.
 */
export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <output
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 py-16"
    >
      <Spinner className="size-5 text-zinc-400 dark:text-zinc-500" />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
    </output>
  );
}
