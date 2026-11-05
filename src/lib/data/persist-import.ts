import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { PORTAL_AS_OF } from "@/lib/dates";
import type { PortalSnapshot } from "@/lib/domain";
import { commitImport, type ImportSummary } from "@/lib/import/commit";
import type { MappedLicense } from "@/lib/import/validate";

export async function persistImportedRows(
  supabase: SupabaseClient,
  current: PortalSnapshot,
  rows: MappedLicense[],
): Promise<ImportSummary> {
  const planned = commitImport(current, rows, {
    on: PORTAL_AS_OF,
    createId: () => crypto.randomUUID(),
  });
  const next = planned.snapshot;
  const previousOrganizations = new Set(current.organizations.map((item) => item.id));
  const previousLocations = new Map(current.locations.map((item) => [item.id, item]));
  const previousLicenses = new Set(current.licenses.map((item) => item.id));

  const organizations = next.organizations.filter((item) => !previousOrganizations.has(item.id));
  if (organizations.length > 0) {
    const { error } = await supabase.from("organizations").insert(
      organizations.map((item) => ({
        id: item.id,
        name: item.name,
        legal_name: item.legalName,
        npi: item.npi,
        status: item.status,
        city: item.city,
        state: item.state,
        primary_contact: item.primaryContact,
        contact_email: item.contactEmail,
        client_since: item.since,
      })),
    );
    if (error) throw new Error("The roster could not add a pharmacy.");
  }

  const locations = next.locations.filter((item) => !previousLocations.has(item.id));
  if (locations.length > 0) {
    const { error } = await supabase.from("locations").insert(
      locations.map((item) => ({
        id: item.id,
        organization_id: item.organizationId,
        name: item.name,
        address_line1: item.addressLine1,
        address_line2: item.addressLine2,
        city: item.city,
        state: item.state,
        postal_code: item.postalCode,
        phone: item.phone,
        dea_number: item.deaNumber,
        ncpdp: item.ncpdp,
        status: item.status,
      })),
    );
    if (error) throw new Error("The roster could not add a location.");
  }

  for (const location of next.locations) {
    const previous = previousLocations.get(location.id);
    if (!previous) continue;
    if (previous.deaNumber === location.deaNumber && previous.ncpdp === location.ncpdp) continue;
    const { error } = await supabase
      .from("locations")
      .update({ dea_number: location.deaNumber, ncpdp: location.ncpdp })
      .eq("id", location.id);
    if (error) throw new Error("The roster could not update a location.");
  }

  const licenses = next.licenses.filter((item) => !previousLicenses.has(item.id));
  if (licenses.length > 0) {
    const { error } = await supabase.from("licenses").insert(
      licenses.map((item) => ({
        id: item.id,
        organization_id: item.organizationId,
        location_id: item.locationId,
        license_number: item.licenseNumber,
        license_type: item.licenseType,
        issuing_authority: item.issuingAuthority,
        state: item.state,
        status: item.status,
        issued_on: item.issuedOn,
        expires_on: item.expiresOn,
        holder_name: item.holderName,
        notes: item.notes,
      })),
    );
    if (error) throw new Error("The roster could not add a license.");
  }

  return planned.summary;
}
