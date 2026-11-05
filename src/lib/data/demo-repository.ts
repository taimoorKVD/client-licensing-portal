import { PORTAL_AS_OF } from "@/lib/dates";
import { displayStatus, type PortalSnapshot } from "@/lib/domain";
import type { LicenseQuery, LicensingRepository } from "@/lib/data/repository";

export function createDemoRepository(snapshot: PortalSnapshot): LicensingRepository {
  return {
    async listOrganizations() {
      return snapshot.organizations;
    },
    async listLocations(organizationId) {
      return snapshot.locations.filter((location) =>
        organizationId ? location.organizationId === organizationId : true,
      );
    },
    async listLicenses(query) {
      return snapshot.licenses.filter((license) => matches(license, snapshot, query));
    },
    async getLicense(id) {
      return snapshot.licenses.find((license) => license.id === id) ?? null;
    },
    async listDocuments(licenseId) {
      return snapshot.documents.filter((document) => document.licenseId === licenseId);
    },
  };
}

function matches(
  license: PortalSnapshot["licenses"][number],
  snapshot: PortalSnapshot,
  query: LicenseQuery | undefined,
): boolean {
  if (!query) return true;
  if (query.organizationId && license.organizationId !== query.organizationId) return false;
  if (query.state && license.state !== query.state) return false;
  if (query.status === "expiring") {
    if (displayStatus(license, PORTAL_AS_OF) !== "expiring") return false;
  } else if (query.status && license.status !== query.status) {
    return false;
  }
  if (query.search) {
    const organization = snapshot.organizations.find((item) => item.id === license.organizationId);
    const haystack = [
      license.licenseNumber,
      license.licenseType,
      license.holderName,
      license.issuingAuthority,
      organization?.name ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query.search.toLowerCase())) return false;
  }
  return true;
}
