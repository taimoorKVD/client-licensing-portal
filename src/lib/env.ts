/**
 * Public Supabase settings. The secret key is intentionally not read here.
 * A file imported by browser code must never read the service-role key.
 * When the public URL and key are present, the portal always uses the
 * signed-in session. Demo mode is only the local UI with no project connected.
 */

export type DataSourceMode = "demo" | "supabase";

function read(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function getSupabaseEnv(): { url: string; publishableKey: string } {
  const url = read("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey =
    read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    read("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url, publishableKey };
}

export function isSupabaseConfigured(): boolean {
  const { url, publishableKey } = getSupabaseEnv();
  return url.length > 0 && publishableKey.length > 0;
}

export function getDataSource(): DataSourceMode {
  if (isSupabaseConfigured()) return "supabase";
  return "demo";
}

export function describeDataSource(): { mode: DataSourceMode; detail: string } {
  if (getDataSource() === "supabase") {
    return {
      mode: "supabase",
      detail:
        "Signed-in access. Row Level Security and staff permissions decide which pharmacies and actions are available.",
    };
  }

  return {
    mode: "demo",
    detail:
      "Local sample book. No Supabase project is configured, so this browser copy is not the live directory.",
  };
}
