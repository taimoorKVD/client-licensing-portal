import { PORTAL_AS_OF, daysBetween } from "./dates";

export const LICENSE_STATUSES = [
  "active",
  "pending",
  "expired",
  "suspended",
] as const;

export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const DISPLAY_STATUSES = [
  "active",
  "expiring",
  "expired",
  "pending",
  "suspended",
] as const;

export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export const ORGANIZATION_STATUSES = [
  "active",
  "onboarding",
  "inactive",
] as const;

export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];

export const LOCATION_STATUSES = ["active", "inactive"] as const;
export type LocationStatus = (typeof LOCATION_STATUSES)[number];

export const DOCUMENT_KINDS = [
  "certificate",
  "application",
  "renewal",
  "correspondence",
  "other",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const PERSONA_IDS = ["cml_admin", "harbor", "mesa"] as const;
export type PersonaId = (typeof PERSONA_IDS)[number];

export type PortalRole = "cml_admin" | "pharmacy_client";

export type Organization = {
  id: string;
  name: string;
  legalName: string;
  npi: string | null;
  status: OrganizationStatus;
  city: string;
  state: string;
  primaryContact: string;
  contactEmail: string;
  since: string;
};

export type Location = {
  id: string;
  organizationId: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  phone: string | null;
  deaNumber: string | null;
  ncpdp: string | null;
  status: LocationStatus;
};

export type License = {
  id: string;
  organizationId: string;
  locationId: string | null;
  licenseNumber: string;
  licenseType: string;
  issuingAuthority: string;
  state: string;
  status: LicenseStatus;
  issuedOn: string | null;
  expiresOn: string | null;
  holderName: string;
  notes: string | null;
  source: "book" | "import";
};

export type LicenseDocument = {
  id: string;
  organizationId: string;
  licenseId: string;
  title: string;
  kind: DocumentKind;
  fileName: string | null;
  mimeType: string | null;
  href: string | null;
  uploadedOn: string | null;
  placeholder: boolean;
};

export type ActivityItem = {
  id: string;
  at: string;
  title: string;
  detail: string;
  organizationId: string | null;
};

export type PortalSnapshot = {
  organizations: Organization[];
  locations: Location[];
  licenses: License[];
  documents: LicenseDocument[];
  activity: ActivityItem[];
};

export type Persona = {
  id: PersonaId;
  role: PortalRole;
  label: string;
  detail: string;
  organizationId: string | null;
};

export const PERSONAS: Persona[] = [
  {
    id: "cml_admin",
    role: "cml_admin",
    label: "CML Admin",
    detail: "All client pharmacies",
    organizationId: null,
  },
  {
    id: "harbor",
    role: "pharmacy_client",
    label: "Harbor & Pine Pharmacy",
    detail: "Pharmacy client",
    organizationId: "org_harbor",
  },
  {
    id: "mesa",
    role: "pharmacy_client",
    label: "Mesa Verde Rx",
    detail: "Pharmacy client",
    organizationId: "org_mesa",
  },
];

export function isPersonaId(value: string | null | undefined): value is PersonaId {
  return PERSONA_IDS.some((id) => id === value);
}

export function personaById(id: PersonaId): Persona {
  const persona = PERSONAS.find((item) => item.id === id);
  if (!persona) return PERSONAS[0];
  return persona;
}

/** Expiring is derived. The stored status stays active until the license lapses. */
export function displayStatus(
  license: Pick<License, "status" | "expiresOn">,
  asOf = PORTAL_AS_OF,
): DisplayStatus {
  if (license.status !== "active" || !license.expiresOn) return license.status;
  const remaining = daysBetween(asOf, license.expiresOn);
  if (remaining >= 0 && remaining <= 90) return "expiring";
  return "active";
}

export function daysUntilExpiry(
  license: Pick<License, "expiresOn">,
  asOf = PORTAL_AS_OF,
): number | null {
  if (!license.expiresOn) return null;
  return daysBetween(asOf, license.expiresOn);
}

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  active: "Active",
  expiring: "Expiring",
  expired: "Expired",
  pending: "Pending",
  suspended: "Suspended",
};

export const ORGANIZATION_STATUS_LABEL: Record<OrganizationStatus, string> = {
  active: "Active client",
  onboarding: "Onboarding",
  inactive: "Inactive",
};

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  certificate: "Certificate",
  application: "Application",
  renewal: "Renewal",
  correspondence: "Correspondence",
  other: "Other",
};
