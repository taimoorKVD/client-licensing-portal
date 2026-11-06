"use server";

import { revalidatePath } from "next/cache";
import { canImportRoster, canWriteLicenses } from "@/lib/auth/access";
import { requirePortalSession } from "@/lib/auth/session";
import { importRosterSchema, licenseStatusUpdateSchema } from "@/lib/auth/schemas";
import { PORTAL_AS_OF } from "@/lib/dates";
import { appPath } from "@/lib/paths";
import type { ImportSummary } from "@/lib/import/commit";
import type { LicenseStatus } from "@/lib/domain";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function updateLicenseStatus(
  id: string,
  status: LicenseStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requirePortalSession();
  if (!canWriteLicenses(session.actor)) {
    return { ok: false, error: "You do not have permission to change a license." };
  }
  const parsed = licenseStatusUpdateSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: "That status is not valid." };

  const { data, error } = await session.supabase
    .from("licenses")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: "The license was not updated." };
  }
  revalidatePath(appPath("/licenses"));
  revalidatePath(appPath(`/licenses/${parsed.data.id}`));
  revalidatePath(appPath("/"));
  return { ok: true };
}

export async function importRoster(
  rows: unknown,
): Promise<Result<ImportSummary>> {
  const session = await requirePortalSession();
  if (!canImportRoster(session.actor)) {
    return { ok: false, error: "You do not have permission to import a roster." };
  }
  const parsed = importRosterSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: "The roster did not pass the server check." };

  const { data: existingLicenses, error: licenseError } = await session.supabase
    .from("licenses")
    .select("id, organization_id, license_number, issuing_authority");
  if (licenseError) return { ok: false, error: "The current book could not be read." };
  const { data: organizations, error: organizationError } = await session.supabase
    .from("organizations")
    .select("id, name, legal_name");
  if (organizationError) return { ok: false, error: "The pharmacies could not be read." };
  const { data: locations, error: locationError } = await session.supabase
    .from("locations")
    .select("id, organization_id, name, dea_number, ncpdp");
  if (locationError) return { ok: false, error: "The locations could not be read." };

  const orgs = (organizations ?? []) as { id: string; name: string; legal_name: string }[];
  const sites = (locations ?? []) as {
    id: string;
    organization_id: string;
    name: string;
    dea_number: string | null;
    ncpdp: string | null;
  }[];
  const known = new Set(
    ((existingLicenses ?? []) as { organization_id: string; license_number: string; issuing_authority: string }[])
      .map((row) => licenseKey(orgName(orgs, row.organization_id), row.license_number, row.issuing_authority)),
  );

  let organizationsCreated = 0;
  let locationsCreated = 0;
  const licenseIds: string[] = [];

  for (const row of parsed.data) {
    const key = licenseKey(row.organizationName, row.licenseNumber, row.issuingAuthority);
    if (known.has(key)) {
      return {
        ok: false,
        error: `${row.licenseNumber} is already in the book for ${row.organizationName}. Nothing further was added after ${licenseIds.length} license${licenseIds.length === 1 ? "" : "s"}.`,
      };
    }

    let organization = orgs.find((item) => item.name.toLowerCase() === row.organizationName.toLowerCase());
    if (!organization) {
      const { data, error } = await session.supabase
        .from("organizations")
        .insert({
          name: row.organizationName,
          legal_name: row.organizationName,
          status: "onboarding",
          city: row.city || "—",
          state: row.state,
          primary_contact: "Imported contact",
          contact_email: row.contactEmail || "licensing@cml.example",
          client_since: PORTAL_AS_OF,
        })
        .select("id, name, legal_name")
        .single();
      if (error || !data) return { ok: false, error: "A pharmacy in the roster was not created." };
      organization = data as { id: string; name: string; legal_name: string };
      orgs.push(organization);
      organizationsCreated += 1;
    }

    let location = sites.find(
      (item) =>
        item.organization_id === organization.id &&
        item.name.toLowerCase() === row.locationName.toLowerCase(),
    );
    if (!location) {
      const { data, error } = await session.supabase
        .from("locations")
        .insert({
          organization_id: organization.id,
          name: row.locationName,
          address_line1: row.addressLine1 || "Address pending",
          city: row.city || "—",
          state: row.state,
          postal_code: row.postalCode || "—",
          dea_number: row.deaNumber || null,
          ncpdp: row.ncpdp || null,
          status: "active",
        })
        .select("id, organization_id, name, dea_number, ncpdp")
        .single();
      if (error || !data) return { ok: false, error: "A location in the roster was not created." };
      location = data as (typeof sites)[number];
      sites.push(location);
      locationsCreated += 1;
    } else if ((row.deaNumber && !location.dea_number) || (row.ncpdp && !location.ncpdp)) {
      const { error } = await session.supabase
        .from("locations")
        .update({
          dea_number: location.dea_number || row.deaNumber || null,
          ncpdp: location.ncpdp || row.ncpdp || null,
        })
        .eq("id", location.id);
      if (error) return { ok: false, error: "A location in the roster was not updated." };
    }

    const { data: license, error: insertError } = await session.supabase
      .from("licenses")
      .insert({
        organization_id: organization.id,
        location_id: location.id,
        license_number: row.licenseNumber,
        license_type: row.licenseType,
        issuing_authority: row.issuingAuthority,
        state: row.state,
        status: row.status,
        issued_on: row.issuedOn,
        expires_on: row.expiresOn,
        holder_name: organization.legal_name,
        notes: row.notes || null,
      })
      .select("id")
      .single();
    if (insertError || !license) {
      return { ok: false, error: "A license in the roster was not added." };
    }
    licenseIds.push((license as { id: string }).id);
    known.add(key);
  }

  revalidatePath(appPath("/"));
  revalidatePath(appPath("/licenses"));
  revalidatePath(appPath("/organizations"));
  revalidatePath(appPath("/locations"));
  return {
    ok: true,
    data: {
      organizationsCreated,
      locationsCreated,
      licensesCreated: licenseIds.length,
      licenseIds,
    },
  };
}

function orgName(orgs: { id: string; name: string }[], id: string): string {
  return orgs.find((item) => item.id === id)?.name ?? "";
}

function licenseKey(organizationName: string, licenseNumber: string, issuingAuthority: string): string {
  return [organizationName, licenseNumber, issuingAuthority].map((part) => part.trim().toLowerCase()).join("|");
}
