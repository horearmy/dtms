'use client';

import { useEffect } from 'react';
import { patchFetchCsrf } from '@/lib/csrf';

export default function CsrfProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    patchFetchCsrf();
  }, []);

  return <>{children}</>;
}
