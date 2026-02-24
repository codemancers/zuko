'use client';

import { useEffect, useRef } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { useProgress } from '@bprogress/react';
import { useRouter as useBProgressRouter } from '@bprogress/next';

export function GlobalLoadingIndicator() {
  const isFetching = useIsFetching();
  const progress = useProgress();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track Next.js navigation
  useBProgressRouter();

  // Track React Query fetches
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (isFetching > 0) {
      // Add delay to prevent flicker on fast requests
      timeoutRef.current = setTimeout(() => {
        progress.start();
      }, 150);
    } else {
      progress.stop();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isFetching, progress]);

  return null;
}
