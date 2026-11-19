import { useMemo, useSyncExternalStore } from 'react';

/**
 * A stand-in for `next/navigation` whose URL really changes: replacing it re-renders whatever
 * reads it, like the real router. Install it with:
 *
 *   vi.mock('next/navigation', async () => (await import('@/test/navigation-mock')).navigationModule);
 */
const state = { pathname: '/records/contact', search: '' };
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const emit = () => listeners.forEach((listener) => listener());

/** Go to a URL, as `router.replace` would. */
function to(target: string) {
  const [pathname, query = ''] = target.split('?');
  state.pathname = pathname;
  state.search = query;
  emit();
}

export const navigation = {
  /** The query string now, without the "?". */
  get search() {
    return state.search;
  },
  get params() {
    return new URLSearchParams(state.search);
  },
  /** Start a test at a URL. */
  reset(search = '') {
    state.pathname = '/records/contact';
    state.search = search.replace(/^\?/, '');
  },
  /** Change the URL from outside the component: back, forward, or following a link. */
  go(search: string) {
    to(`${state.pathname}?${search.replace(/^\?/, '')}`);
  },
};

const router = { replace: to, push: to };

export const navigationModule = {
  useRouter: () => router,
  usePathname: () =>
    useSyncExternalStore(
      subscribe,
      () => state.pathname,
      () => state.pathname,
    ),
  useSearchParams: () => {
    const search = useSyncExternalStore(
      subscribe,
      () => state.search,
      () => state.search,
    );
    return useMemo(() => new URLSearchParams(search), [search]);
  },
};
