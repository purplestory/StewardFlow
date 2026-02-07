import { createClient } from "@supabase/supabase-js";

// Admin client using Service Role Key - Bypasses RLS
// USE WITH CAUTION: Only use in server-side contexts (Server Actions, API Routes)
export const createSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
};
