"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/portal/page-header";
import { usePortal } from "@/components/portal/portal-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function LocationsView() {
  const { isAdmin, organizations, locations, licenses } = usePortal();
  const [query, setQuery] = useState("");
  const [state, setState] = useState("all");
  const states = useMemo(
    () => [...new Set(locations.map((location) => location.state))].sort(),
    [locations],
  );

  const filtered = locations.filter((location) => {
    if (state !== "all" && location.state !== state) return false;
    if (!query.trim()) return true;
    const organization = organizations.find((item) => item.id === location.organizationId);
    const haystack = `${location.name} ${location.city} ${location.addressLine1} ${organization?.name ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Sites"
        title={isAdmin ? "Where each\npermit lives." : "Your locations.\nOne site at a time."}
        description="Each permit is tied to a dispensing site. DEA and NCPDP numbers sit on the location so a renewal is not confused with the legal entity."
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="grid gap-1.5">
          <Label htmlFor="location-search">Search</Label>
          <Input
            id="location-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, city, or street"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="location-state">State</Label>
          <select
            id="location-state"
            value={state}
            onChange={(event) => setState(event.target.value)}
            className="h-9 rounded-xl border border-input bg-card px-2.5 text-sm"
          >
            <option value="all">All states</option>
            {states.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Location</TableHead>
              {isAdmin ? <TableHead>Pharmacy</TableHead> : null}
              <TableHead>Address</TableHead>
              <TableHead>DEA</TableHead>
              <TableHead>Licenses</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((location) => {
              const organization = organizations.find((item) => item.id === location.organizationId);
              const count = licenses.filter((item) => item.locationId === location.id).length;
              return (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">{location.name}</TableCell>
                  {isAdmin ? (
                    <TableCell>
                      {organization ? (
                        <Link href={`/organizations/${organization.id}`} className="font-medium hover:text-primary hover:underline">
                          {organization.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  ) : null}
                  <TableCell>
                    {location.addressLine1}
                    <div className="text-xs text-muted-foreground">
                      {location.city}, {location.state} {location.postalCode}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{location.deaNumber ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{count}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 5 : 4} className="py-8 text-center text-muted-foreground">
                  No locations match this search.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
