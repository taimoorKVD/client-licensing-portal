"use client";

import Link from "next/link";
import { LicenseTable } from "@/components/portal/license-table";
import { PageHeader } from "@/components/portal/page-header";
import { usePortal } from "@/components/portal/portal-provider";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { ORGANIZATION_STATUS_LABEL } from "@/lib/domain";

export function OrganizationDetailView({ id }: { id: string }) {
  const { isAdmin, organizationById, locations, licenses } = usePortal();
  const organization = organizationById(id);

  if (!organization) {
    return (
      <PageHeader
        eyebrow="Clients"
        title="Pharmacy not in this view"
        description="This organization is outside the pharmacy you are viewing. Switch to CML Admin to see the full book."
      />
    );
  }

  const orgLocations = locations.filter((item) => item.organizationId === organization.id);
  const orgLicenses = licenses.filter((item) => item.organizationId === organization.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={isAdmin ? "Client" : "Your pharmacy"}
        title={organization.name}
        description={organization.legalName}
        actions={
          <Link
            href={`/licenses?org=${organization.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            All licenses
          </Link>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <Fact label="Status" value={ORGANIZATION_STATUS_LABEL[organization.status]} />
        <Fact label="Primary contact" value={`${organization.primaryContact} · ${organization.contactEmail}`} />
        <Fact label="NPI" value={organization.npi ?? "Not on file"} extra={`Client since ${formatDate(organization.since)}`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Locations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {orgLocations.map((location) => (
            <div key={location.id} className="rounded-xl border border-border px-3 py-3 transition-colors hover:bg-accent/50">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">{location.name}</p>
                <p className="text-xs text-muted-foreground">{location.status === "active" ? "Open" : "Inactive"}</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {location.addressLine1}, {location.city}, {location.state} {location.postalCode}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {location.phone ?? "No phone"} · DEA {location.deaNumber ?? "not on file"} · NCPDP {location.ncpdp ?? "—"}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-medium">Licenses</h2>
        <LicenseTable
          licenses={orgLicenses}
          organizations={[organization]}
          locations={orgLocations}
          showOrganization={false}
        />
      </div>
    </div>
  );
}

function Fact({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
      {extra ? <p className="mt-1 text-xs text-muted-foreground">{extra}</p> : null}
    </div>
  );
}
