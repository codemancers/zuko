import { useEffect, useRef, useCallback } from 'react';

export function useInfiniteScroll(
  fetchNextPage: () => void,
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const onIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(onIntersect, {
      rootMargin: '200px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onIntersect]);

  return sentinelRef;
}
