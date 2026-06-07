// Service-role Supabase client — SERVER ONLY. Bypasses RLS.
// Used exclusively by background enrichment (/api/enrich) to update products
// after the operator already moved on. Never import this from client code.
//
// Every query made through this client MUST filter by warehouse_id explicitly,
// because RLS is OFF here. The tenant id is resolved from the authenticated
// user before calling into the admin client.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL",
    );
  }
  return createSupabaseClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
