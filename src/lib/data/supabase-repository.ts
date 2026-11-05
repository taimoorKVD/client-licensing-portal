import { PORTAL_AS_OF } from "@/lib/dates";
import type {
  DocumentKind,
  License,
  LicenseDocument,
  LicenseStatus,
  Location,
  LocationStatus,
  Organization,
  OrganizationStatus,
} from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";
import type { LicensingRepository } from "@/lib/data/repository";

type OrganizationRow = {
  id: string;
  name: string;
  legal_name: string;
  npi: string | null;
  status: OrganizationStatus;
  city: string;
  state: string;
  primary_contact: string;
  contact_email: string;
  client_since: string;
};

type LocationRow = {
  id: string;
  organization_id: string;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  phone: string | null;
  dea_number: string | null;
  ncpdp: string | null;
  status: LocationStatus;
};

type LicenseRow = {
  id: string;
  organization_id: string;
  location_id: string | null;
  license_number: string;
  license_type: string;
  issuing_authority: string;
  state: string;
  status: LicenseStatus;
  issued_on: string | null;
  expires_on: string | null;
  holder_name: string;
  notes: string | null;
};

type DocumentRow = {
  id: string;
  organization_id: string;
  license_id: string;
  title: string;
  kind: DocumentKind;
  file_name: string | null;
  mime_type: string | null;
  storage_path: string | null;
  uploaded_on: string | null;
};

/**
 * Queries run with the user session from cookies. Policies in
 * supabase/migrations enforce tenant isolation. This file does not create a
 * service-role client.
 */
export async function createSupabaseLicensingRepository(): Promise<LicensingRepository> {
  const supabase = await createClient();

  return {
    async listOrganizations() {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data as OrganizationRow[]).map(mapOrganization);
    },
    async listLocations(organizationId) {
      let request = supabase.from("locations").select("*").order("name");
      if (organizationId) request = request.eq("organization_id", organizationId);
      const { data, error } = await request;
      if (error) throw error;
      return (data as LocationRow[]).map(mapLocation);
    },
    async listLicenses(query) {
      let request = supabase.from("licenses").select("*").order("expires_on", { ascending: true });
      if (query?.organizationId) request = request.eq("organization_id", query.organizationId);
      if (query?.state) request = request.eq("state", query.state);
      if (query?.status && query.status !== "expiring") request = request.eq("status", query.status);
      if (query?.status === "expiring") {
        request = request.eq("status", "active").gte("expires_on", PORTAL_AS_OF).lte("expires_on", addDays(PORTAL_AS_OF, 90));
      }
      if (query?.search) {
        const term = `%${query.search.replaceAll("%", "")}%`;
        request = request.or(
          `license_number.ilike.${term},license_type.ilike.${term},holder_name.ilike.${term},issuing_authority.ilike.${term}`,
        );
      }
      const { data, error } = await request;
      if (error) throw error;
      return (data as LicenseRow[]).map(mapLicense);
    },
    async getLicense(id) {
      const { data, error } = await supabase.from("licenses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? mapLicense(data as LicenseRow) : null;
    },
    async listDocuments(licenseId) {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("license_id", licenseId)
        .order("uploaded_on", { ascending: false });
      if (error) throw error;
      return (data as DocumentRow[]).map(mapDocument);
    },
    async listAllDocuments() {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("uploaded_on", { ascending: false });
      if (error) throw error;
      return (data as DocumentRow[]).map(mapDocument);
    },
  };
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function mapOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    legalName: row.legal_name,
    npi: row.npi,
    status: row.status,
    city: row.city,
    state: row.state,
    primaryContact: row.primary_contact,
    contactEmail: row.contact_email,
    since: row.client_since,
  };
}

function mapLocation(row: LocationRow): Location {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    phone: row.phone,
    deaNumber: row.dea_number,
    ncpdp: row.ncpdp,
    status: row.status,
  };
}

function mapLicense(row: LicenseRow): License {
  return {
    id: row.id,
    organizationId: row.organization_id,
    locationId: row.location_id,
    licenseNumber: row.license_number,
    licenseType: row.license_type,
    issuingAuthority: row.issuing_authority,
    state: row.state,
    status: row.status,
    issuedOn: row.issued_on,
    expiresOn: row.expires_on,
    holderName: row.holder_name,
    notes: row.notes,
    source: "book",
  };
}

function mapDocument(row: DocumentRow): LicenseDocument {
  return {
    id: row.id,
    organizationId: row.organization_id,
    licenseId: row.license_id,
    title: row.title,
    kind: row.kind,
    fileName: row.file_name,
    mimeType: row.mime_type,
    href: publicSampleHref(row.storage_path),
    uploadedOn: row.uploaded_on,
    placeholder: !row.storage_path,
  };
}

function publicSampleHref(storagePath: string | null): string | null {
  if (!storagePath?.startsWith("samples/")) return null;
  return `/${storagePath}`;
}
