import type {
  ActivityItem,
  License,
  LicenseDocument,
  Location,
  Organization,
  PortalSnapshot,
} from "./domain";

const organizations: Organization[] = [
  {
    id: "org_harbor",
    name: "Harbor & Pine Pharmacy",
    legalName: "Harbor & Pine Pharmacy, LLC",
    npi: "1679543208",
    status: "active",
    city: "Seattle",
    state: "WA",
    primaryContact: "Elena Voss",
    contactEmail: "elena.voss@harborandpine.example",
    since: "2016-04-11",
  },
  {
    id: "org_lakeside",
    name: "Lakeside Community Pharmacy",
    legalName: "Lakeside Community Pharmacy, Inc.",
    npi: "1847203315",
    status: "active",
    city: "Madison",
    state: "WI",
    primaryContact: "Marcus Hale",
    contactEmail: "marcus.hale@lakesiderx.example",
    since: "2012-09-03",
  },
  {
    id: "org_northline",
    name: "Northline Apothecary Group",
    legalName: "Northline Apothecary Group, P.C.",
    npi: "1396802247",
    status: "active",
    city: "Boston",
    state: "MA",
    primaryContact: "Priya Shah",
    contactEmail: "priya.shah@northline.example",
    since: "2008-01-22",
  },
  {
    id: "org_mesa",
    name: "Mesa Verde Rx",
    legalName: "Mesa Verde Rx, LLC",
    npi: "1528094416",
    status: "active",
    city: "Tucson",
    state: "AZ",
    primaryContact: "Andre Solis",
    contactEmail: "andre.solis@mesaverderx.example",
    since: "2019-06-18",
  },
  {
    id: "org_beacon",
    name: "Beacon Hill Compounding",
    legalName: "Beacon Hill Compounding, LLC",
    npi: "1765439082",
    status: "onboarding",
    city: "Boston",
    state: "MA",
    primaryContact: "Helen Cho",
    contactEmail: "helen.cho@beaconcompound.example",
    since: "2025-11-04",
  },
];

const locations: Location[] = [
  loc("loc_harbor_ballard", "org_harbor", "Ballard", "5401 22nd Ave NW", "Seattle", "WA", "98107", "(206) 555-0148", "AB4829103", "4928811"),
  loc("loc_harbor_fremont", "org_harbor", "Fremont", "708 N 35th St", "Seattle", "WA", "98103", "(206) 555-0172", "BB1109288", "4928844"),
  loc("loc_harbor_tacoma", "org_harbor", "Tacoma", "1421 Pacific Ave", "Tacoma", "WA", "98402", "(253) 555-0194", null, "4928902"),
  loc("loc_lake_monroe", "org_lakeside", "Monroe Street", "402 E Mifflin St", "Madison", "WI", "53703", "(608) 555-0116", "FL2291004", "3312044"),
  loc("loc_lake_verona", "org_lakeside", "Verona", "108 S Main St", "Verona", "WI", "53593", "(608) 555-0160", "FL5088120", "3312088"),
  loc("loc_north_cambridge", "org_northline", "Cambridge", "88 Prospect St", "Cambridge", "MA", "02139", "(617) 555-0133", "BN4412093", "2201841"),
  loc("loc_north_somerville", "org_northline", "Somerville", "255 Elm St", "Somerville", "MA", "02144", "(617) 555-0188", "BN9144001", "2201860"),
  loc("loc_north_brookline", "org_northline", "Brookline", "14 Harvard St", "Brookline", "MA", "02445", "(617) 555-0127", "BN8800219", "2201877"),
  loc("loc_north_portsmouth", "org_northline", "Portsmouth", "61 Congress St", "Portsmouth", "NH", "03801", "(603) 555-0155", "BN4481902", "2201904"),
  loc("loc_mesa_broadway", "org_mesa", "Broadway", "2740 E Broadway Blvd", "Tucson", "AZ", "85716", "(520) 555-0104", "FM2284106", "6104421"),
  loc("loc_mesa_oro", "org_mesa", "Oro Valley", "10180 N Oracle Rd", "Oro Valley", "AZ", "85737", "(520) 555-0190", "FM2300288", "6104438"),
  loc("loc_beacon_charles", "org_beacon", "Charles Street", "77 Charles St", "Boston", "MA", "02114", "(617) 555-0141", "BB7701402", "2201991"),
];

const licenses: License[] = [
  permit("lic_harbor_ballard_pharmacy", "org_harbor", "loc_harbor_ballard", "PH-WA-104482", "State Pharmacy Permit", "Washington State Board of Pharmacy", "WA", "active", "2024-03-12", "2027-06-30", null),
  dea("lic_harbor_ballard_dea", "org_harbor", "loc_harbor_ballard", "AB4829103", "WA", "active", "2024-04-01", "2027-03-31", null),
  cs("lic_harbor_ballard_cs", "org_harbor", "loc_harbor_ballard", "CS-WA-22910", "Washington State Department of Health", "WA", "active", "2024-03-12", "2027-01-20", null),
  permit("lic_harbor_fremont_pharmacy", "org_harbor", "loc_harbor_fremont", "PH-WA-110902", "State Pharmacy Permit", "Washington State Board of Pharmacy", "WA", "active", "2025-02-14", "2028-02-14", null),
  dea("lic_harbor_fremont_dea", "org_harbor", "loc_harbor_fremont", "BB1109288", "WA", "active", "2024-11-01", "2027-11-01", null),
  permit("lic_harbor_tacoma_pharmacy", "org_harbor", "loc_harbor_tacoma", "PH-WA-098331", "State Pharmacy Permit", "Washington State Board of Pharmacy", "WA", "pending", null, null, "Application accepted. The permit number is reserved and approval is still open."),
  dea("lic_harbor_tacoma_dea", "org_harbor", "loc_harbor_tacoma", "DEA-APP-TACOMA", "WA", "pending", "2026-08-20", null, "DEA application filed for the new Tacoma counter. No registration has been issued."),
  permit("lic_lake_monroe_pharmacy", "org_lakeside", "loc_lake_monroe", "4412-PH", "State Pharmacy Permit", "Wisconsin Pharmacy Examining Board", "WI", "active", "2024-08-01", "2027-08-01", null),
  dea("lic_lake_monroe_dea", "org_lakeside", "loc_lake_monroe", "FL2291004", "WI", "active", "2023-12-15", "2026-12-15", null),
  cs("lic_lake_monroe_cs", "org_lakeside", "loc_lake_monroe", "19-CS-4412", "Wisconsin Controlled Substances Board", "WI", "active", "2024-08-01", "2027-08-01", null),
  permit("lic_lake_verona_pharmacy", "org_lakeside", "loc_lake_verona", "5088-PH", "State Pharmacy Permit", "Wisconsin Pharmacy Examining Board", "WI", "active", "2024-04-30", "2027-04-30", null),
  dea("lic_lake_verona_dea", "org_lakeside", "loc_lake_verona", "FL5088120", "WI", "active", "2025-01-09", "2028-01-09", null),
  permit("lic_north_cambridge_pharmacy", "org_northline", "loc_north_cambridge", "DS90211", "State Pharmacy Permit", "Massachusetts Board of Registration in Pharmacy", "MA", "active", "2024-01-15", "2027-12-31", null),
  dea("lic_north_cambridge_dea", "org_northline", "loc_north_cambridge", "BN4412093", "MA", "active", "2024-05-20", "2027-05-20", null),
  cs("lic_north_cambridge_cs", "org_northline", "loc_north_cambridge", "MCSR-22841", "Massachusetts Department of Public Health", "MA", "active", "2024-01-15", "2027-12-31", null),
  permit("lic_north_somerville_pharmacy", "org_northline", "loc_north_somerville", "DS91440", "State Pharmacy Permit", "Massachusetts Board of Registration in Pharmacy", "MA", "active", "2023-11-28", "2026-11-28", "Renewal packet is drafted and has not been filed."),
  dea("lic_north_somerville_dea", "org_northline", "loc_north_somerville", "BN9144001", "MA", "active", "2024-09-01", "2027-09-01", null),
  permit("lic_north_brookline_pharmacy", "org_northline", "loc_north_brookline", "DS88002", "State Pharmacy Permit", "Massachusetts Board of Registration in Pharmacy", "MA", "active", "2025-03-15", "2028-03-15", null),
  dea("lic_north_brookline_dea", "org_northline", "loc_north_brookline", "BN8800219", "MA", "active", "2024-06-30", "2027-06-30", null),
  permit("lic_north_portsmouth_pharmacy", "org_northline", "loc_north_portsmouth", "PH-4481", "State Pharmacy Permit", "New Hampshire Board of Pharmacy", "NH", "active", "2024-07-31", "2027-07-31", null),
  dea("lic_north_portsmouth_dea", "org_northline", "loc_north_portsmouth", "BN4481902", "NH", "expired", "2023-10-01", "2026-10-01", "Renewal was not filed before expiration. Controlled substances should not ship from this site."),
  cs("lic_north_portsmouth_cs", "org_northline", "loc_north_portsmouth", "CS-NH-118", "New Hampshire Board of Pharmacy", "NH", "active", "2024-07-31", "2027-07-31", null),
  permit("lic_mesa_broadway_pharmacy", "org_mesa", "loc_mesa_broadway", "Y-22841", "State Pharmacy Permit", "Arizona State Board of Pharmacy", "AZ", "active", "2024-05-01", "2027-05-01", null),
  dea("lic_mesa_broadway_dea", "org_mesa", "loc_mesa_broadway", "FM2284106", "AZ", "expired", "2023-08-12", "2026-08-12", "Registration lapsed in August. A new DEA form is not in the file."),
  cs("lic_mesa_broadway_cs", "org_mesa", "loc_mesa_broadway", "CS-AZ-773", "Arizona State Board of Pharmacy", "AZ", "suspended", "2023-09-01", "2026-09-01", "Suspended after the August inspection. The response letter is not on file."),
  permit("lic_mesa_oro_pharmacy", "org_mesa", "loc_mesa_oro", "Y-23002", "State Pharmacy Permit", "Arizona State Board of Pharmacy", "AZ", "active", "2024-09-18", "2027-09-18", null),
  dea("lic_mesa_oro_dea", "org_mesa", "loc_mesa_oro", "FM2300288", "AZ", "active", "2024-02-02", "2027-02-02", null),
  permit("lic_beacon_pharmacy", "org_beacon", "loc_beacon_charles", "DS77014", "State Pharmacy Permit", "Massachusetts Board of Registration in Pharmacy", "MA", "active", "2024-10-01", "2027-10-01", null),
  dea("lic_beacon_dea", "org_beacon", "loc_beacon_charles", "BB7701402", "MA", "active", "2024-04-12", "2027-04-12", null),
  permit("lic_beacon_compound", "org_beacon", "loc_beacon_charles", "CP-4419", "Nonsterile Compounding Permit", "Massachusetts Board of Registration in Pharmacy", "MA", "active", "2024-10-01", "2027-10-01", null),
  permit("lic_beacon_sterile", "org_beacon", "loc_beacon_charles", "SC-110", "Sterile Compounding Permit", "Massachusetts Board of Registration in Pharmacy", "MA", "pending", "2026-09-30", null, "Filed September 30. The board has not issued the permit."),
];

const certificate = "/samples/pharmacy-license-certificate.pdf";

const documents: LicenseDocument[] = [
  doc("doc_harbor_ballard_cert", "org_harbor", "lic_harbor_ballard_pharmacy", "State pharmacy permit", "certificate", "pharmacy-license-certificate.pdf", certificate, "2024-03-18", false),
  doc("doc_harbor_ballard_renewal", "org_harbor", "lic_harbor_ballard_cs", "Controlled substance renewal checklist", "renewal", null, null, null, true),
  doc("doc_lake_monroe_cert", "org_lakeside", "lic_lake_monroe_pharmacy", "Wisconsin pharmacy permit", "certificate", "pharmacy-license-certificate.pdf", certificate, "2024-08-06", false),
  doc("doc_north_cambridge_cert", "org_northline", "lic_north_cambridge_pharmacy", "Massachusetts pharmacy permit", "certificate", "pharmacy-license-certificate.pdf", certificate, "2024-01-20", false),
  doc("doc_north_portsmouth_letter", "org_northline", "lic_north_portsmouth_dea", "DEA lapse note", "correspondence", null, null, null, true),
  doc("doc_mesa_cert", "org_mesa", "lic_mesa_broadway_pharmacy", "Arizona pharmacy permit", "certificate", "pharmacy-license-certificate.pdf", certificate, "2024-05-08", false),
  doc("doc_mesa_deficiency", "org_mesa", "lic_mesa_broadway_cs", "Inspection deficiency letter", "correspondence", null, null, null, true),
  doc("doc_beacon_cert", "org_beacon", "lic_beacon_pharmacy", "Massachusetts pharmacy permit", "certificate", "pharmacy-license-certificate.pdf", certificate, "2024-10-04", false),
  doc("doc_beacon_sterile_app", "org_beacon", "lic_beacon_sterile", "Sterile compounding application", "application", null, null, null, true),
];

const activity: ActivityItem[] = [
  {
    id: "act_review",
    at: "2026-10-28",
    title: "Roster reviewed",
    detail: "CML checked expiration dates across the active book before the November board cycle.",
    organizationId: null,
  },
  {
    id: "act_mesa",
    at: "2026-10-16",
    title: "Mesa Verde deficiency",
    detail: "The Broadway controlled substance registration is suspended until the inspection response is filed.",
    organizationId: "org_mesa",
  },
  {
    id: "act_portsmouth",
    at: "2026-10-03",
    title: "Portsmouth DEA lapsed",
    detail: "Northline Portsmouth DEA registration expired on October 1 and still needs a renewal packet.",
    organizationId: "org_northline",
  },
  {
    id: "act_beacon",
    at: "2026-09-30",
    title: "Sterile compounding filed",
    detail: "Beacon Hill Compounding submitted the sterile compounding permit. It is still pending.",
    organizationId: "org_beacon",
  },
];

export const seedSnapshot: PortalSnapshot = {
  organizations,
  locations,
  licenses,
  documents,
  activity,
};

export function cloneSeed(): PortalSnapshot {
  return {
    organizations: organizations.map((item) => ({ ...item })),
    locations: locations.map((item) => ({ ...item })),
    licenses: licenses.map((item) => ({ ...item })),
    documents: documents.map((item) => ({ ...item })),
    activity: activity.map((item) => ({ ...item })),
  };
}

function loc(
  id: string,
  organizationId: string,
  name: string,
  addressLine1: string,
  city: string,
  state: string,
  postalCode: string,
  phone: string,
  deaNumber: string | null,
  ncpdp: string,
): Location {
  return {
    id,
    organizationId,
    name,
    addressLine1,
    addressLine2: null,
    city,
    state,
    postalCode,
    phone,
    deaNumber,
    ncpdp,
    status: "active",
  };
}

function permit(
  id: string,
  organizationId: string,
  locationId: string,
  licenseNumber: string,
  licenseType: string,
  issuingAuthority: string,
  state: string,
  status: License["status"],
  issuedOn: string | null,
  expiresOn: string | null,
  notes: string | null,
): License {
  const organization = organizations.find((item) => item.id === organizationId);
  return {
    id,
    organizationId,
    locationId,
    licenseNumber,
    licenseType,
    issuingAuthority,
    state,
    status,
    issuedOn,
    expiresOn,
    holderName: organization?.legalName ?? organizationId,
    notes,
    source: "book",
  };
}

function dea(
  id: string,
  organizationId: string,
  locationId: string,
  licenseNumber: string,
  state: string,
  status: License["status"],
  issuedOn: string | null,
  expiresOn: string | null,
  notes: string | null,
): License {
  return permit(
    id,
    organizationId,
    locationId,
    licenseNumber,
    "DEA Registration",
    "Drug Enforcement Administration",
    state,
    status,
    issuedOn,
    expiresOn,
    notes,
  );
}

function cs(
  id: string,
  organizationId: string,
  locationId: string,
  licenseNumber: string,
  issuingAuthority: string,
  state: string,
  status: License["status"],
  issuedOn: string | null,
  expiresOn: string | null,
  notes: string | null,
): License {
  return permit(
    id,
    organizationId,
    locationId,
    licenseNumber,
    "Controlled Substance Registration",
    issuingAuthority,
    state,
    status,
    issuedOn,
    expiresOn,
    notes,
  );
}

function doc(
  id: string,
  organizationId: string,
  licenseId: string,
  title: string,
  kind: LicenseDocument["kind"],
  fileName: string | null,
  href: string | null,
  uploadedOn: string | null,
  placeholder: boolean,
): LicenseDocument {
  return {
    id,
    organizationId,
    licenseId,
    title,
    kind,
    fileName,
    mimeType: href ? "application/pdf" : null,
    href,
    uploadedOn,
    placeholder,
  };
}
