import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Service-role client for Auth admin calls (create, ban, delete).
 * Import this only from server actions. It must never be bundled for the browser.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("The service role client cannot run in the browser.");
  }

  const { url } = getSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
  if (!url || !secret) {
    throw new Error("SUPABASE_SECRET_KEY is not set. Account administration stays on the server.");
  }

  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
