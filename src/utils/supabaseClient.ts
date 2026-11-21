import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://ibtamnpkagjmnlzuejju.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_x58mXjZn9G73E9vDMavXXw_LsvWJ1Ai';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseUrl(): string {
  return (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || DEFAULT_SUPABASE_URL;
}

export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = getSupabaseUrl();
  const key =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || DEFAULT_SUPABASE_KEY;
  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
  return cachedClient;
}
