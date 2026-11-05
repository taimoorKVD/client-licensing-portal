import { PORTAL_AS_OF, addDays, formatDate } from "./dates";
import {
  daysUntilExpiry,
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

export type RenewalWindow = {
  id: "30" | "60" | "90" | "later";
  label: string;
  detail: string;
  count: number;
};

/** Active and expiring licenses, grouped by days remaining from the book date. */
export function renewalWindows(licenses: License[], asOf = PORTAL_AS_OF): RenewalWindow[] {
  const inForce = licenses.filter((license) => {
    const status = displayStatus(license, asOf);
    return status === "active" || status === "expiring";
  });

  const countBetween = (min: number, max: number | null) =>
    inForce.filter((license) => {
      const remaining = daysUntilExpiry(license, asOf);
      if (remaining === null || remaining < min) return false;
      return max === null ? true : remaining <= max;
    }).length;

  return [
    {
      id: "30",
      label: "0–30 days",
      detail: `${formatDate(asOf)} – ${formatDate(addDays(asOf, 30))}`,
      count: countBetween(0, 30),
    },
    {
      id: "60",
      label: "31–60 days",
      detail: `${formatDate(addDays(asOf, 31))} – ${formatDate(addDays(asOf, 60))}`,
      count: countBetween(31, 60),
    },
    {
      id: "90",
      label: "61–90 days",
      detail: `${formatDate(addDays(asOf, 61))} – ${formatDate(addDays(asOf, 90))}`,
      count: countBetween(61, 90),
    },
    {
      id: "later",
      label: "Beyond 90 days",
      detail: `${formatDate(addDays(asOf, 91))}+`,
      count: countBetween(91, null),
    },
  ];
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
