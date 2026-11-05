/**
 * Public Supabase settings. Values are placeholders until a project is connected.
 * The secret key is intentionally not read here. It must never be exposed with
 * a NEXT_PUBLIC_ prefix, and this demo does not use a service-role client.
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
  const requested = read("NEXT_PUBLIC_DATA_SOURCE") || "demo";
  if (requested === "supabase" && isSupabaseConfigured()) return "supabase";
  return "demo";
}

export function describeDataSource(): { mode: DataSourceMode; detail: string } {
  if (getDataSource() === "supabase") {
    return {
      mode: "supabase",
      detail:
        "Live mode reads and writes through Supabase as the signed-in user. Row Level Security keeps each pharmacy inside its own organization.",
    };
  }

  return {
    mode: "demo",
    detail:
      "Demo book in this browser. The Supabase migration is ready when you connect a project.",
  };
}
