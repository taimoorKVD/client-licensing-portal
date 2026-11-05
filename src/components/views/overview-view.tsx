"use client";

import Link from "next/link";
import { PageHeader } from "@/components/portal/page-header";
import { usePortal } from "@/components/portal/portal-provider";
import { StatusBadge } from "@/components/portal/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateLong, PORTAL_AS_OF } from "@/lib/dates";
import { displayStatus, ORGANIZATION_STATUS_LABEL } from "@/lib/domain";
import { licenseMetrics, needsAttention, organizationIssueCount } from "@/lib/metrics";

export function OverviewView() {
  const { isAdmin, persona, organizations, locations, licenses, activity, organizationById, locationById } =
    usePortal();
  const metrics = licenseMetrics(licenses);
  const attention = needsAttention(licenses).slice(0, 6);
  const ranked = [...organizations].sort(
    (a, b) => organizationIssueCount(b, licenses) - organizationIssueCount(a, licenses),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={isAdmin ? "CML desk" : "Pharmacy workspace"}
        title={isAdmin ? "What needs a person this week" : persona.label}
        description={
          isAdmin
            ? `The client book as of ${formatDateLong(PORTAL_AS_OF)}. Expiring means an active license reaches its date within 90 days.`
            : "CML keeps this license book. You can review what is on file for your pharmacies. Filings and status changes stay with CML."
        }
        actions={
          isAdmin ? (
            <Link href="/import" className={buttonVariants()}>
              Import roster
            </Link>
          ) : (
            <Link href="/licenses?status=expiring" className={buttonVariants({ variant: "outline" })}>
              Review renewals
            </Link>
          )
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="In the book" value={metrics.total} hint={`${locations.length} locations`} />
        <Stat label="In good standing" value={metrics.active} hint="Active, outside 90 days" />
        <Stat label="Expiring" value={metrics.expiring} hint="Active, due within 90 days" tone="warn" />
        <Stat label="Expired or suspended" value={metrics.expired + metrics.suspended} hint={`${metrics.expired} expired · ${metrics.suspended} suspended`} tone="alert" />
        <Stat label="Pending" value={metrics.pending} hint="Filed, not issued" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Open items</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {attention.length === 0 ? (
              <p className="px-4 text-sm text-muted-foreground">Nothing in this book needs attention.</p>
            ) : (
              <ul className="divide-y">
                {attention.map((license) => {
                  const organization = organizationById(license.organizationId);
                  const location = license.locationId ? locationById(license.locationId) : undefined;
                  return (
                    <li key={license.id}>
                      <Link
                        href={`/licenses/${license.id}`}
                        className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-muted/60"
                      >
                        <span>
                          <span className="block text-sm font-medium">{license.licenseNumber}</span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {organization?.name}
                            {location ? ` · ${location.name}` : ""} · {license.licenseType}
                          </span>
                        </span>
                        <span className="flex flex-col items-end gap-1">
                          <StatusBadge license={license} />
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatDate(license.expiresOn)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{isAdmin ? "Clients" : "Your book"}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {ranked.map((organization) => {
                const count = organizationIssueCount(organization, licenses);
                const total = licenses.filter((item) => item.organizationId === organization.id).length;
                return (
                  <Link
                    key={organization.id}
                    href={`/organizations/${organization.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted/50"
                  >
                    <span>
                      <span className="block text-sm font-medium">{organization.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {organization.city}, {organization.state} · {ORGANIZATION_STATUS_LABEL[organization.status]}
                      </span>
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      <span className="block font-medium text-foreground tabular-nums">{total}</span>
                      {count > 0 ? `${count} open` : "Clear"}
                    </span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent notes</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {activity.slice(0, 4).map((item) => (
                <div key={item.id}>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    {formatDate(item.at)} · {item.detail}
                  </p>
                </div>
              ))}
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes for this pharmacy yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        {attention.filter((license) => displayStatus(license) === "expiring").length} of the open items above are still active and simply approaching their date.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "default" | "warn" | "alert";
}) {
  const bar =
    tone === "alert" ? "bg-[oklch(0.53_0.14_35)]" : tone === "warn" ? "bg-[oklch(0.72_0.11_75)]" : "bg-primary";
  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className={`h-1 ${bar}`} />
      <div className="px-4 py-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 font-heading text-3xl tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
