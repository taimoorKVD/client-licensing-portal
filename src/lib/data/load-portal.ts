import "server-only";

import type { ActivityItem, PortalSnapshot } from "@/lib/domain";
import { createSupabaseLicensingRepository } from "@/lib/data/supabase-repository";
import { createClient } from "@/lib/supabase/server";

export async function loadPortalSnapshot(): Promise<PortalSnapshot> {
  const repository = await createSupabaseLicensingRepository();
  const [organizations, locations, licenses, documents] = await Promise.all([
    repository.listOrganizations(),
    repository.listLocations(),
    repository.listLicenses(),
    repository.listAllDocuments(),
  ]);

  return {
    organizations,
    locations,
    licenses,
    documents,
    activity: await loadActivity(),
  };
}

async function loadActivity(): Promise<ActivityItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, occurred_at, summary, organization_id, action")
    .order("occurred_at", { ascending: false })
    .limit(8);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    at: String(row.occurred_at).slice(0, 10),
    title: titleFor(String(row.action)),
    detail: String(row.summary),
    organizationId: (row.organization_id as string | null) ?? null,
  }));
}

function titleFor(action: string): string {
  if (action.startsWith("auth.")) return "Directory";
  if (action.includes("licenses")) return "License book";
  if (action.includes("roles")) return "Roles";
  return "Record";
}
