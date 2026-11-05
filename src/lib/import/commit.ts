import type { Location, PortalSnapshot } from "../domain";
import type { MappedLicense } from "./validate";

export type ImportSummary = {
  organizationsCreated: number;
  locationsCreated: number;
  licensesCreated: number;
  licenseIds: string[];
};

export function commitImport(
  snapshot: PortalSnapshot,
  rows: MappedLicense[],
  options: {
    on: string;
    createId?: (prefix: string) => string;
  },
): { snapshot: PortalSnapshot; summary: ImportSummary } {
  const organizations = snapshot.organizations.map((item) => ({ ...item }));
  const locations = snapshot.locations.map((item) => ({ ...item }));
  const licenses = snapshot.licenses.map((item) => ({ ...item }));
  const documents = snapshot.documents.map((item) => ({ ...item }));
  const activity = snapshot.activity.map((item) => ({ ...item }));

  let sequence = 0;
  const createId = options.createId ?? ((prefix: string) => {
    sequence += 1;
    return `${prefix}_${options.on.replaceAll("-", "")}_${sequence.toString(36)}`;
  });

  let organizationsCreated = 0;
  let locationsCreated = 0;
  const licenseIds: string[] = [];
  const touchedOrgs = new Set<string>();

  for (const row of rows) {
    let organization = organizations.find(
      (item) => item.name.toLowerCase() === row.organizationName.toLowerCase(),
    );
    if (!organization) {
      organization = {
        id: createId("org"),
        name: row.organizationName,
        legalName: row.organizationName,
        npi: null,
        status: "onboarding",
        city: row.city || "—",
        state: row.state,
        primaryContact: "Imported contact",
        contactEmail: row.contactEmail || "licensing@cml.example",
        since: options.on,
      };
      organizations.push(organization);
      organizationsCreated += 1;
    }

    let location = locations.find(
      (item) =>
        item.organizationId === organization.id &&
        item.name.toLowerCase() === row.locationName.toLowerCase(),
    );
    if (!location) {
      location = {
        id: createId("loc"),
        organizationId: organization.id,
        name: row.locationName,
        addressLine1: row.addressLine1 || "Address pending",
        addressLine2: null,
        city: row.city || "—",
        state: row.state,
        postalCode: row.postalCode || "—",
        phone: null,
        deaNumber: row.deaNumber || null,
        ncpdp: row.ncpdp || null,
        status: "active",
      };
      locations.push(location);
      locationsCreated += 1;
    } else {
      const current = location;
      const patch: Partial<Location> = {};
      if (row.deaNumber && !current.deaNumber) patch.deaNumber = row.deaNumber;
      if (row.ncpdp && !current.ncpdp) patch.ncpdp = row.ncpdp;
      if (Object.keys(patch).length > 0) {
        const index = locations.findIndex((item) => item.id === current.id);
        locations[index] = { ...current, ...patch };
        location = locations[index];
      }
    }

    const license = {
      id: createId("lic"),
      organizationId: organization.id,
      locationId: location.id,
      licenseNumber: row.licenseNumber,
      licenseType: row.licenseType,
      issuingAuthority: row.issuingAuthority,
      state: row.state,
      status: row.status,
      issuedOn: row.issuedOn,
      expiresOn: row.expiresOn,
      holderName: organization.legalName,
      notes: row.notes || null,
      source: "import" as const,
    };
    licenses.push(license);
    licenseIds.push(license.id);
    touchedOrgs.add(organization.id);
  }

  activity.unshift({
    id: createId("act"),
    at: options.on,
    title: "Roster imported",
    detail: `${licenseIds.length} license${licenseIds.length === 1 ? "" : "s"} added from a spreadsheet.`,
    organizationId: touchedOrgs.size === 1 ? [...touchedOrgs][0] : null,
  });

  return {
    snapshot: { organizations, locations, licenses, documents, activity },
    summary: {
      organizationsCreated,
      locationsCreated,
      licensesCreated: licenseIds.length,
      licenseIds,
    },
  };
}
