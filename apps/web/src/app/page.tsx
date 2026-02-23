'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authClient.getSession();
        if (session?.data?.user) {
          // User is logged in, redirect to chat
          router.push('/chat');
        } else {
          // User is not logged in, redirect to sign-in
          router.push('/sign-in');
        }
      } catch (error) {
        // On error, redirect to sign-in
        router.push('/sign-in');
      }
    };

    checkAuth();
  }, [router]);

  // Show nothing while checking auth and redirecting
  return null;
}
