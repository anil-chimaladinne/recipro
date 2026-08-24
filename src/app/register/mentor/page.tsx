'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function MentorRegisterPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/register');
  }, [router]);

  return null;
}
