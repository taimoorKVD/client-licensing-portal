"use client";

import Link from "next/link";
import { CalendarRange, FileStack, ShieldCheck, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/portal/page-header";
import { usePortal } from "@/components/portal/portal-provider";
import { StatusBadge } from "@/components/portal/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, formatDateLong, PORTAL_AS_OF } from "@/lib/dates";
import {
  ORGANIZATION_STATUS_LABEL,
  daysUntilExpiry,
  displayStatus,
  type License,
} from "@/lib/domain";
import { licenseMetrics, organizationIssueCount, renewalWindows } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export function OverviewView() {
  const { isAdmin, persona, organizations, locations, licenses, activity, organizationById, locationById } =
    usePortal();
  const metrics = licenseMetrics(licenses);
  const windows = renewalWindows(licenses);
  const focus = windows.find((window) => window.id !== "later" && window.count > 0)?.id ?? "later";
  const standing = metrics.total === 0 ? 0 : Math.round((metrics.active / metrics.total) * 100);
  const cards = spotlight(licenses);
  const ranked = [...organizations].sort(
    (a, b) => organizationIssueCount(b, licenses) - organizationIssueCount(a, licenses),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={isAdmin ? "CML desk" : "Pharmacy workspace"}
        title={isAdmin ? "Every permit.\nAccounted for." : `${persona.label}.\nYour book only.`}
        description={
          isAdmin
            ? `The client book as of ${formatDateLong(PORTAL_AS_OF)}. Expiring soon means an active license reaches its date within 90 days.`
            : "CML keeps the filings. This view is only the licenses, locations, and notes for your pharmacy."
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

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={FileStack} label="Total licenses" value={String(metrics.total)} hint={`${locations.length} locations`} />
        <Stat icon={CalendarRange} label="Expiring soon" value={String(metrics.expiring)} hint="Active, due within 90 days" />
        <Stat icon={ShieldCheck} label="In good standing" value={`${standing}%`} hint={`${metrics.active} clear of the 90-day window`} />
        <Stat
          icon={TriangleAlert}
          label="Overdue"
          value={String(metrics.expired)}
          hint={metrics.suspended ? `${metrics.suspended} also suspended` : "Past the expiration date"}
          alert
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Renewal window</h2>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            From {formatDate(PORTAL_AS_OF)}
          </span>
        </div>
        <ol className="mt-6 grid gap-4 md:grid-cols-4">
          {windows.map((window, index) => {
            const selected = window.id === focus;
            return (
              <li key={window.id} className="relative">
                {index < windows.length - 1 ? (
                  <span className="absolute top-3 left-[calc(50%+1rem)] hidden h-px w-[calc(100%-1rem)] bg-border md:block" />
                ) : null}
                <Link
                  href={`/licenses?within=${window.id}`}
                  className={cn(
                    "relative flex h-full flex-col rounded-2xl border px-3 py-3 transition-colors",
                    selected
                      ? "border-primary/30 bg-accent"
                      : "border-border bg-background hover:border-primary/30 hover:bg-accent/60",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground",
                    )}
                  >
                    {window.label}
                  </span>
                  <span className="mt-3 text-sm font-semibold text-foreground">
                    {window.count} license{window.count === 1 ? "" : "s"}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">{window.detail}</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">On the desk</h2>
          <Link href="/licenses" className="text-sm font-semibold text-primary hover:underline">
            View all licenses
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((license) => {
            const organization = organizationById(license.organizationId);
            const location = license.locationId ? locationById(license.locationId) : undefined;
            const remaining = daysUntilExpiry(license);
            const status = displayStatus(license);
            const overdue = remaining !== null && remaining < 0;
            return (
              <Link
                key={license.id}
                href={`/licenses/${license.id}`}
                className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)] transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <StatusBadge license={license} className="w-fit" />
                <p className="mt-3 text-sm font-semibold">{license.licenseType}</p>
                <p className="mt-1 text-sm text-muted-foreground">{organization?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {location?.name ? `${location.name} · ` : ""}
                  {license.licenseNumber}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">{overdue ? "Expired" : "Expires"}</p>
                    <p
                      className={cn(
                        "mt-1 font-semibold",
                        status === "expired" || status === "suspended"
                          ? "text-destructive"
                          : status === "expiring"
                            ? "text-[oklch(0.5_0.13_55)]"
                            : "text-primary",
                      )}
                    >
                      {formatDate(license.expiresOn)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{overdue ? "Days overdue" : "Days left"}</p>
                    <p className="mt-1 font-semibold text-foreground tabular-nums">
                      {remaining === null ? "—" : Math.abs(remaining)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]">
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-lg font-semibold">{isAdmin ? "Clients" : "Your pharmacy"}</h2>
          <ul className="mt-3 divide-y">
            {ranked.map((organization) => {
              const open = organizationIssueCount(organization, licenses);
              const total = licenses.filter((item) => item.organizationId === organization.id).length;
              return (
                <li key={organization.id}>
                  <Link
                    href={`/organizations/${organization.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-accent/70"
                  >
                    <span>
                      <span className="block text-sm font-semibold">{organization.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {organization.city}, {organization.state} · {ORGANIZATION_STATUS_LABEL[organization.status]}
                      </span>
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      <span className="block text-base font-semibold text-foreground tabular-nums">{total}</span>
                      {open > 0 ? `${open} open` : "Clear"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <h2 className="text-lg font-semibold">Recent notes</h2>
          <ul className="mt-3 grid gap-4">
            {activity.slice(0, 4).map((item) => (
              <li key={item.id}>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {formatDate(item.at)} · {item.detail}
                </p>
              </li>
            ))}
            {activity.length === 0 ? (
              <li className="text-sm text-muted-foreground">No notes for this pharmacy yet.</li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}

function spotlight(licenses: License[]): License[] {
  const ranked = (status: ReturnType<typeof displayStatus>) =>
    licenses
      .filter((license) => displayStatus(license) === status)
      .sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"));
  const picked: License[] = [];
  const take = (list: License[], fromEnd = false) => {
    const source = fromEnd ? [...list].reverse() : list;
    for (const license of source) {
      if (picked.length >= 4) return;
      if (!picked.some((item) => item.id === license.id)) picked.push(license);
    }
  };
  take(ranked("expired"));
  take(ranked("suspended"));
  take(ranked("expiring"));
  take(ranked("active"), true);
  take(ranked("pending"));
  return picked.slice(0, 4);
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  alert = false,
}: {
  icon: typeof FileStack;
  label: string;
  value: string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <div className="flex items-start justify-between rounded-2xl border border-border bg-card px-4 py-4 shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)]">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("mt-2 text-4xl font-semibold tracking-tight tabular-nums", alert ? "text-destructive" : "text-primary")}>
          {value}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </div>
      <span className={cn("grid size-10 place-items-center rounded-xl", alert ? "bg-destructive/10 text-destructive" : "bg-accent text-primary")}>
        <Icon className="size-5" />
      </span>
    </div>
  );
}
