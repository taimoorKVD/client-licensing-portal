"use server";

import { revalidatePath } from "next/cache";
import { LICENSE_STATUSES, type LicenseStatus } from "@/lib/domain";
import { validateWorkbook, type MappedLicense, type SheetRow } from "@/lib/import/validate";
import type { ColumnMap } from "@/lib/import/fields";
import { canImportRoster, canWriteLicense } from "@/lib/auth/policy";
import { requirePortalSession, toPrincipal } from "@/lib/auth/session";
import { loadPortalSnapshot } from "@/lib/data/load-portal";
import { persistImportedRows } from "@/lib/data/persist-import";
import { createClient } from "@/lib/supabase/server";
import type { ImportSummary } from "@/lib/import/commit";

export async function updateLicenseStatusAction(
  id: string,
  status: LicenseStatus,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const session = await requirePortalSession();
  if (!canWriteLicense(toPrincipal(session))) {
    return { ok: false, message: "You cannot change license status." };
  }
  if (!LICENSE_STATUSES.includes(status)) {
    return { ok: false, message: "Unknown status." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("licenses")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, message: "That license was not updated." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function importRosterAction(input: {
  rows: SheetRow[];
  columnMap: ColumnMap;
}): Promise<{ ok: true; summary: ImportSummary } | { ok: false; message: string }> {
  const session = await requirePortalSession();
  if (!canImportRoster(toPrincipal(session))) {
    return { ok: false, message: "You cannot import a roster." };
  }

  const snapshot = await loadPortalSnapshot();
  const existing = snapshot.licenses.map((license) => ({
    organizationName:
      snapshot.organizations.find((item) => item.id === license.organizationId)?.name ?? "",
    licenseNumber: license.licenseNumber,
    issuingAuthority: license.issuingAuthority,
  }));
  const validated = validateWorkbook(input.rows, input.columnMap, existing);
  const ready: MappedLicense[] = validated.flatMap((row) => (row.ready && row.values ? [row.values] : []));
  if (ready.length === 0) {
    return { ok: false, message: "No rows are ready to import." };
  }

  try {
    const supabase = await createClient();
    const summary = await persistImportedRows(supabase, snapshot, ready);
    revalidatePath("/", "layout");
    return { ok: true, summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The roster was not imported.";
    return { ok: false, message };
  }
}
