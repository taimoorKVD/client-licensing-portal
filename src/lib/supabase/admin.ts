import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Service-role client. Import only from server actions and route handlers.
 * The browser bundle never receives this module (`server-only`), and the key
 * is not a NEXT_PUBLIC_ variable.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
  if (!url || !secret) {
    throw new Error("SUPABASE_SECRET_KEY is required for account administration.");
  }

  return createClient(url, secret, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function revokeUserSessions(userId: string): Promise<void> {
  const { url } = getSupabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() ?? "";
  if (!url || !secret) {
    throw new Error("SUPABASE_SECRET_KEY is required for account administration.");
  }

  const endpoint = new URL(`/auth/v1/admin/users/${userId}/logout`, url);
  endpoint.searchParams.set("scope", "global");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      apikey: secret,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  if (!response.ok && response.status !== 404) {
    throw new Error("The existing sessions could not be revoked.");
  }
}
