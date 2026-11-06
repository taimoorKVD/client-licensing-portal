"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/portal/page-header";
import { usePortal } from "@/components/portal/portal-provider";
import { StatusBadge } from "@/components/portal/status-badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/dates";
import {
  DOCUMENT_KIND_LABEL,
  LICENSE_STATUSES,
  STATUS_LABEL,
  daysUntilExpiry,
  type LicenseStatus,
} from "@/lib/domain";
import { appPath } from "@/lib/paths";
import { toast } from "sonner";

export function LicenseDetailView({ id }: { id: string }) {
  const {
    can,
    licenseById,
    organizationById,
    locationById,
    documentsFor,
    updateLicenseStatus,
  } = usePortal();
  const license = licenseById(id);

  if (!license) {
    return (
      <PageHeader
        eyebrow="License"
        title="Not in this view"
        description="This license is outside the pharmacy you are viewing, or it is not in the demo book."
      />
    );
  }

  const organization = organizationById(license.organizationId);
  const location = license.locationId ? locationById(license.locationId) : undefined;
  const documents = documentsFor(license.id);
  const remaining = daysUntilExpiry(license);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={license.licenseType}
        title={license.licenseNumber}
        description={license.issuingAuthority}
        actions={<StatusBadge license={license} />}
      />

      <Tabs defaultValue="record">
        <TabsList>
          <TabsTrigger value="record">Record</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="record" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <dl className="grid gap-3 sm:grid-cols-2">
              <Field label="Holder" value={license.holderName} />
              <Field
                label="Pharmacy"
                value={organization?.name ?? "—"}
                href={organization ? appPath(`/organizations/${organization.id}`) : undefined}
              />
              <Field
                label="Location"
                value={
                  location
                    ? `${location.name}, ${location.city}, ${location.state}`
                    : "Not tied to a location"
                }
              />
              <Field label="State" value={license.state} />
              <Field label="Issued" value={formatDate(license.issuedOn)} />
              <Field
                label="Expires"
                value={formatDate(license.expiresOn)}
                extra={
                  remaining === null
                    ? undefined
                    : remaining < 0
                      ? `${Math.abs(remaining)} days past expiration`
                      : `${remaining} days remaining`
                }
              />
              <Field label="Stored status" value={STATUS_LABEL[license.status] ?? license.status} />
              <Field label="Source" value={license.source === "import" ? "Spreadsheet import" : "CML book"} />
            </dl>

            <aside className="rounded-2xl border border-border bg-card p-4">
              {can("staff.licenses.write") ? (
                <StatusEditor
                  current={license.status}
                  onSave={async (status) => {
                    const result = await updateLicenseStatus(license.id, status);
                    if (result && !result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success(`${license.licenseNumber} marked ${STATUS_LABEL[status].toLowerCase()}`);
                  }}
                />
              ) : (
                <div>
                  <p className="text-sm font-medium">Managed by CML</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Status changes and filings are made by a CML admin. This workspace is the copy your pharmacy can review.
                  </p>
                </div>
              )}
              {license.notes ? (
                <p className="mt-4 border-t pt-4 text-sm leading-6 text-muted-foreground">{license.notes}</p>
              ) : null}
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <div className="grid gap-3">
            {documents.length === 0 ? (
              <div className="rounded-xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
                No document slots are attached to this license yet.
              </div>
            ) : (
              documents.map((document) => (
                <article
                  key={document.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">{document.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {DOCUMENT_KIND_LABEL[document.kind]}
                      {document.uploadedOn ? ` · ${formatDate(document.uploadedOn)}` : ""}
                      {document.placeholder ? " · Placeholder" : ""}
                    </p>
                  </div>
                  {document.href ? (
                    <Button render={<a href={document.href} download />} variant="outline">
                      Download sample PDF
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">File not uploaded</p>
                  )}
                </article>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({
  label,
  value,
  extra,
  href,
}: {
  label: string;
  value: string;
  extra?: string;
  href?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">
        {href ? (
          <Link href={href} className="hover:underline">
            {value}
          </Link>
        ) : (
          value
        )}
      </dd>
      {extra ? <p className="mt-1 text-xs text-muted-foreground">{extra}</p> : null}
    </div>
  );
}

function StatusEditor({
  current,
  onSave,
}: {
  current: LicenseStatus;
  onSave: (status: LicenseStatus) => Promise<void>;
}) {
  const [status, setStatus] = useState<LicenseStatus>(current);
  return (
    <div className="grid gap-3">
      <div>
        <p className="text-sm font-medium">Update status</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Stored status only. Expiring stays derived from the date.
        </p>
      </div>
      <Select
        value={status}
        onValueChange={(value) => {
          if (value && LICENSE_STATUSES.includes(value as LicenseStatus)) {
            setStatus(value as LicenseStatus);
          }
        }}
      >
        <SelectTrigger className="w-full" aria-label="License status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LICENSE_STATUSES.map((item) => (
            <SelectItem key={item} value={item}>
              {STATUS_LABEL[item]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button disabled={status === current} onClick={() => onSave(status)}>
        Save status
      </Button>
    </div>
  );
}
