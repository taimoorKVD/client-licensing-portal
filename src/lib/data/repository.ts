import type {
  License,
  LicenseDocument,
  Location,
  Organization,
} from "@/lib/domain";

export type LicenseQuery = {
  organizationId?: string;
  state?: string;
  status?: "active" | "pending" | "expired" | "suspended" | "expiring";
  search?: string;
};

/**
 * The only door the app uses to read licensing data.
 * Demo mode serves the in-browser book. Supabase mode uses the signed-in
 * session, so Row Level Security — not a service-role key — decides which
 * organizations come back.
 */
export interface LicensingRepository {
  listOrganizations(): Promise<Organization[]>;
  listLocations(organizationId?: string): Promise<Location[]>;
  listLicenses(query?: LicenseQuery): Promise<License[]>;
  getLicense(id: string): Promise<License | null>;
  listDocuments(licenseId: string): Promise<LicenseDocument[]>;
}
