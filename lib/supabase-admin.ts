import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseAdminInstance: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminInstance) {
    return supabaseAdminInstance;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Allow build to proceed without env vars, but throw at runtime
  if (!url || !key) {
    if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable');
    }
    // For build time only, use placeholders
    supabaseAdminInstance = createClient(
      url || 'https://placeholder.supabase.co',
      key || 'placeholder-key',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    return supabaseAdminInstance;
  }

  // Server-only Supabase admin client with service role key
  // NEVER expose this to the browser
  supabaseAdminInstance = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminInstance;
}

export const supabaseAdmin = getSupabaseAdmin();
