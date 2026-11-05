import Link from "next/link";
import { StatusBadge } from "@/components/portal/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import type { License, Location, Organization } from "@/lib/domain";

export function LicenseTable({
  licenses,
  organizations,
  locations,
  showOrganization = true,
}: {
  licenses: License[];
  organizations: Organization[];
  locations: Location[];
  showOrganization?: boolean;
}) {
  if (licenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-12 text-center">
        <p className="font-heading text-lg">No licenses in this view</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Adjust the filters, or import a roster if you are working as CML.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>License</TableHead>
            {showOrganization ? <TableHead>Pharmacy</TableHead> : null}
            <TableHead>Location</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {licenses.map((license) => {
            const organization = organizations.find((item) => item.id === license.organizationId);
            const location = locations.find((item) => item.id === license.locationId);
            return (
              <TableRow key={license.id}>
                <TableCell>
                  <Link
                    href={`/licenses/${license.id}`}
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {license.licenseNumber}
                  </Link>
                  <div className="text-xs text-muted-foreground">{license.state}</div>
                </TableCell>
                {showOrganization ? (
                  <TableCell>
                    {organization ? (
                      <Link
                        href={`/organizations/${organization.id}`}
                        className="hover:underline"
                      >
                        {organization.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                ) : null}
                <TableCell>{location?.name ?? "—"}</TableCell>
                <TableCell className="max-w-48">
                  <div>{license.licenseType}</div>
                  {license.source === "import" ? (
                    <div className="text-xs text-muted-foreground">Imported</div>
                  ) : null}
                </TableCell>
                <TableCell className="tabular-nums">{formatDate(license.expiresOn)}</TableCell>
                <TableCell>
                  <StatusBadge license={license} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
