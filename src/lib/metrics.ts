import { PORTAL_AS_OF } from "./dates";
import {
  displayStatus,
  type DisplayStatus,
  type License,
  type Organization,
} from "./domain";

export type LicenseMetrics = {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  pending: number;
  suspended: number;
};

export function licenseMetrics(
  licenses: License[],
  asOf = PORTAL_AS_OF,
): LicenseMetrics {
  const counts: LicenseMetrics = {
    total: licenses.length,
    active: 0,
    expiring: 0,
    expired: 0,
    pending: 0,
    suspended: 0,
  };

  for (const license of licenses) {
    counts[displayStatus(license, asOf)] += 1;
  }

  return counts;
}

export function needsAttention(licenses: License[], asOf = PORTAL_AS_OF): License[] {
  return licenses
    .filter((license) => {
      const status = displayStatus(license, asOf);
      return status === "expiring" || status === "expired" || status === "suspended" || status === "pending";
    })
    .sort((a, b) => attentionRank(displayStatus(a, asOf)) - attentionRank(displayStatus(b, asOf)) || (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"));
}

function attentionRank(status: DisplayStatus): number {
  if (status === "expired") return 0;
  if (status === "suspended") return 1;
  if (status === "expiring") return 2;
  if (status === "pending") return 3;
  return 4;
}

export function organizationIssueCount(
  organization: Organization,
  licenses: License[],
  asOf = PORTAL_AS_OF,
): number {
  return licenses.filter((license) => {
    if (license.organizationId !== organization.id) return false;
    const status = displayStatus(license, asOf);
    return status === "expiring" || status === "expired" || status === "suspended" || status === "pending";
  }).length;
}
