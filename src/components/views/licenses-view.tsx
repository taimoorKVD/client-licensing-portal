"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LicenseTable } from "@/components/portal/license-table";
import { PageHeader } from "@/components/portal/page-header";
import { usePortal } from "@/components/portal/portal-provider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DISPLAY_STATUSES, STATUS_LABEL, daysUntilExpiry, displayStatus } from "@/lib/domain";

export function LicensesView() {
  const { isAdmin, organizations, locations, licenses } = usePortal();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const query = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const state = params.get("state") ?? "all";
  const org = params.get("org") ?? "all";
  const type = params.get("type") ?? "all";
  const within = params.get("within") ?? "all";

  const states = useMemo(
    () => [...new Set(licenses.map((license) => license.state))].sort(),
    [licenses],
  );
  const types = useMemo(
    () => [...new Set(licenses.map((license) => license.licenseType))].sort(),
    [licenses],
  );

  function update(next: Record<string, string>) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value || value === "all") search.delete(key);
      else search.set(key, value);
    }
    const serialized = search.toString();
    router.replace(serialized ? `${pathname}?${serialized}` : pathname, { scroll: false });
  }

  const filtered = licenses.filter((license) => {
    if (status !== "all" && displayStatus(license) !== status) return false;
    if (state !== "all" && license.state !== state) return false;
    if (org !== "all" && license.organizationId !== org) return false;
    if (type !== "all" && license.licenseType !== type) return false;
    if (within !== "all" && !matchesWindow(license, within)) return false;
    if (query.trim()) {
      const organization = organizations.find((item) => item.id === license.organizationId);
      const haystack = `${license.licenseNumber} ${license.licenseType} ${license.issuingAuthority} ${license.holderName} ${organization?.name ?? ""}`.toLowerCase();
      if (!haystack.includes(query.trim().toLowerCase())) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => (a.expiresOn ?? "9999").localeCompare(b.expiresOn ?? "9999"));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Credentials"
        title={isAdmin ? "The license book.\nSearch the whole set." : "Your licenses.\nNothing outside this pharmacy."}
        description={`${sorted.length} showing. Search covers the number, type, authority, holder, and pharmacy name.`}
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="grid gap-1.5 xl:col-span-2">
          <Label htmlFor="license-search">Search</Label>
          <Input
            id="license-search"
            value={query}
            onChange={(event) => update({ q: event.target.value })}
            placeholder="PH-WA-104482 or DEA"
          />
        </div>
        <Filter
          id="license-status"
          label="Status"
          value={status}
          onChange={(value) => update({ status: value })}
          options={[
            ["all", "All statuses"],
            ...DISPLAY_STATUSES.map((item) => [item, STATUS_LABEL[item]] as const),
          ]}
        />
        <Filter
          id="license-state"
          label="State"
          value={state}
          onChange={(value) => update({ state: value })}
          options={[["all", "All states"], ...states.map((item) => [item, item] as const)]}
        />
        <Filter
          id="license-type"
          label="Type"
          value={type}
          onChange={(value) => update({ type: value })}
          options={[["all", "All types"], ...types.map((item) => [item, item] as const)]}
        />
        <Filter
          id="license-window"
          label="Window"
          value={within}
          onChange={(value) => update({ within: value })}
          options={[
            ["all", "Any date"],
            ["30", "Next 30 days"],
            ["60", "31–60 days"],
            ["90", "61–90 days"],
            ["later", "Beyond 90 days"],
          ]}
        />
        {isAdmin ? (
          <Filter
            id="license-org"
            label="Pharmacy"
            value={org}
            onChange={(value) => update({ org: value })}
            options={[
              ["all", "All pharmacies"],
              ...organizations.map((item) => [item.id, item.name] as const),
            ]}
          />
        ) : null}
      </div>

      <LicenseTable
        licenses={sorted}
        organizations={organizations}
        locations={locations}
        showOrganization={isAdmin}
      />
    </div>
  );
}

function matchesWindow(
  license: { status: "active" | "pending" | "expired" | "suspended"; expiresOn: string | null },
  within: string,
): boolean {
  const remaining = daysUntilExpiry(license);
  const shown = displayStatus(license);
  if (shown !== "active" && shown !== "expiring") return false;
  if (remaining === null || remaining < 0) return false;
  if (within === "30") return remaining <= 30;
  if (within === "60") return remaining >= 31 && remaining <= 60;
  if (within === "90") return remaining >= 61 && remaining <= 90;
  if (within === "later") return remaining >= 91;
  return true;
}

function Filter({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-xl border border-input bg-card px-2.5 text-sm"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
