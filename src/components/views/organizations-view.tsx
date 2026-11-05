"use client";

import Link from "next/link";
import { PageHeader } from "@/components/portal/page-header";
import { usePortal } from "@/components/portal/portal-provider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { ORGANIZATION_STATUS_LABEL } from "@/lib/domain";
import { organizationIssueCount } from "@/lib/metrics";
import { OrganizationDetailView } from "@/components/views/organization-detail-view";

export function OrganizationsView() {
  const { isAdmin, organizations, locations, licenses } = usePortal();

  if (!isAdmin && organizations.length === 1) {
    return <OrganizationDetailView id={organizations[0].id} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Clients"
        title={"The pharmacies\nCML already serves."}
        description="This is the managed roster. A later subscription flow can add a pharmacy without a CML operator."
      />
      <div className="grid gap-3 md:hidden">
        {organizations.map((organization) => {
          const locationCount = locations.filter((item) => item.organizationId === organization.id).length;
          const licenseCount = licenses.filter((item) => item.organizationId === organization.id).length;
          const open = organizationIssueCount(organization, licenses);
          return (
            <Link
              key={organization.id}
              href={`/organizations/${organization.id}`}
              className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
            >
              <p className="font-semibold">{organization.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {organization.city}, {organization.state} · {ORGANIZATION_STATUS_LABEL[organization.status]}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {locationCount} locations · {licenseCount} licenses · {open} open
              </p>
            </Link>
          );
        })}
      </div>
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)] md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pharmacy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Locations</TableHead>
              <TableHead>Licenses</TableHead>
              <TableHead>Open items</TableHead>
              <TableHead>Client since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {organizations.map((organization) => {
              const locationCount = locations.filter((item) => item.organizationId === organization.id).length;
              const licenseCount = licenses.filter((item) => item.organizationId === organization.id).length;
              const open = organizationIssueCount(organization, licenses);
              return (
                <TableRow key={organization.id}>
                  <TableCell>
                    <Link href={`/organizations/${organization.id}`} className="font-semibold hover:text-primary hover:underline">
                      {organization.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {organization.city}, {organization.state}
                    </div>
                  </TableCell>
                  <TableCell>{ORGANIZATION_STATUS_LABEL[organization.status]}</TableCell>
                  <TableCell className="tabular-nums">{locationCount}</TableCell>
                  <TableCell className="tabular-nums">{licenseCount}</TableCell>
                  <TableCell className="tabular-nums">{open}</TableCell>
                  <TableCell>{formatDate(organization.since)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
