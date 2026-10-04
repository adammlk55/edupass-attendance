'use client';

import { createBrowserClient } from '@supabase/ssr';

// Browser-only public configuration. Never import server utilities or privileged keys here.
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Le projet Supabase n’est pas encore configuré.');
  return createBrowserClient(url, key);
}
