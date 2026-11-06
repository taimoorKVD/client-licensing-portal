/**
 * Public Supabase settings. The secret key is intentionally not read here.
 * A NEXT_PUBLIC_ value is shipped to the browser, so SUPABASE_SECRET_KEY
 * must stay server-only and is read only by src/lib/auth/admin.ts.
 *
 * Read each NEXT_PUBLIC_ key as a static process.env.NAME access. Dynamic
 * process.env[name] prevents Next/Turbopack from inlining the value into the
 * client bundle, which leaves the browser unable to talk to Supabase.
 */

export type DataSourceMode = "demo" | "supabase" | "unconfigured";

function trimEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function getSupabaseEnv(): { url: string; publishableKey: string } {
  const url = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey =
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
    trimEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return { url, publishableKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, publishableKey } = getSupabaseEnv();
  return url.length > 0 && publishableKey.length > 0;
}

/**
 * Public Supabase values always select the signed-in book.
 * Demo data is a local preview only, and production without keys fails closed.
 */
export function getDataSource(): DataSourceMode {
  const { url, publishableKey } = getSupabaseEnv();
  if (url && publishableKey) return "supabase";
  if (url || publishableKey || process.env.NODE_ENV === "production") return "unconfigured";
  return "demo";
}

export function describeDataSource(): { mode: DataSourceMode; detail: string } {
  const mode = getDataSource();
  if (mode === "supabase") {
    return {
      mode,
      detail:
        "Signed-in access through Supabase. Row Level Security and staff permissions decide what each account can see.",
    };
  }
  if (mode === "unconfigured") {
    return {
      mode,
      detail: "Supabase is not configured. The license book is not served until the server environment is set.",
    };
  }
  return {
    mode,
    detail: "Local preview of the sample book. It is not available once Supabase is configured.",
  };
}
