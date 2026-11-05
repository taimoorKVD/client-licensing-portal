import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityItem, DocumentKind, LicenseDocument, PortalSnapshot } from "@/lib/domain";
import { createSupabaseLicensingRepository } from "@/lib/data/supabase-repository";

type AuditRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  organization_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function loadLiveSnapshot(supabase: SupabaseClient): Promise<PortalSnapshot> {
  const repository = await createSupabaseLicensingRepository();
  const [organizations, locations, licenses, documents, activity] = await Promise.all([
    repository.listOrganizations(),
    repository.listLocations(),
    repository.listLicenses(),
    listDocuments(supabase),
    listActivity(supabase),
  ]);

  return { organizations, locations, licenses, documents, activity };
}

async function listDocuments(supabase: SupabaseClient): Promise<LicenseDocument[]> {
  const { data, error } = await supabase.from("documents").select("*").order("uploaded_on", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as {
    id: string;
    organization_id: string;
    license_id: string;
    title: string;
    kind: DocumentKind;
    file_name: string | null;
    mime_type: string | null;
    storage_path: string | null;
    uploaded_on: string | null;
  }[]).map((row) => {
    const sample = row.storage_path?.startsWith("samples/") ? `/${row.storage_path}` : null;
    return {
      id: row.id,
      organizationId: row.organization_id,
      licenseId: row.license_id,
      title: row.title,
      kind: row.kind,
      fileName: row.file_name,
      mimeType: row.mime_type,
      href: sample,
      uploadedOn: row.uploaded_on,
      placeholder: !sample && !row.storage_path,
    };
  });
}

async function listActivity(supabase: SupabaseClient): Promise<ActivityItem[]> {
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, action, entity_type, entity_id, organization_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) return [];
  return ((data ?? []) as AuditRow[]).map((row) => ({
    id: row.id,
    at: row.created_at.slice(0, 10),
    title: auditTitle(row),
    detail: auditDetail(row),
    organizationId: row.organization_id,
  }));
}

function auditTitle(row: AuditRow): string {
  const action = row.action === "bootstrap" ? "Account bootstrapped" : `${row.action} ${row.entity_type}`;
  return action.charAt(0).toUpperCase() + action.slice(1);
}

function auditDetail(row: AuditRow): string {
  const metadata = row.metadata ?? {};
  if (typeof metadata.license_number === "string" && typeof metadata.status === "string") {
    return `${metadata.license_number} is ${metadata.status}.`;
  }
  if (typeof metadata.email === "string") return metadata.email;
  if (typeof metadata.slug === "string") return metadata.slug;
  if (typeof metadata.permission_key === "string") return metadata.permission_key;
  return row.entity_id ?? row.entity_type;
}
