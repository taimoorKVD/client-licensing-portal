"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/portal/page-header";
import { usePortal } from "@/components/portal/portal-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IMPORT_FIELDS, suggestColumnMap, type ColumnMap } from "@/lib/import/fields";
import { parseWorkbook, type ParsedWorkbook } from "@/lib/import/parse-workbook";
import { validateWorkbook, type ValidatedRow } from "@/lib/import/validate";
import type { ImportSummary } from "@/lib/import/commit";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STEPS = ["Source", "Map", "Validate", "Preview", "Import"] as const;
type Step = (typeof STEPS)[number];

const SAMPLES = [
  {
    href: "/samples/cml-license-roster-review.xlsx",
    fileName: "cml-license-roster-review.xlsx",
    title: "Review roster",
    detail: "Mixed rows. Use this to see mapping, blocked rows, and warnings before anything is added.",
  },
  {
    href: "/samples/cml-license-roster-clean.xlsx",
    fileName: "cml-license-roster-clean.xlsx",
    title: "Clean roster",
    detail: "Redwood Coast Pharmacy. Every row is ready and creates a new client with two locations.",
  },
] as const;

export function ImportView() {
  const { can, organizations, licenses, importRows } = usePortal();
  const isAdmin = can("staff.licenses.import");
  const router = useRouter();
  const [step, setStep] = useState<Step>("Source");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ParsedWorkbook | null>(null);
  const [columnMap, setColumnMap] = useState<ColumnMap>({});
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAdmin) router.replace("/");
  }, [isAdmin, router]);

  const validated = useMemo(() => {
    if (!parsed) return [] as ValidatedRow[];
    const existing = licenses.flatMap((license) => {
      const organization = organizations.find((item) => item.id === license.organizationId);
      if (!organization) return [];
      return [
        {
          organizationName: organization.name,
          licenseNumber: license.licenseNumber,
          issuingAuthority: license.issuingAuthority,
        },
      ];
    });
    return validateWorkbook(parsed.rows, columnMap, existing);
  }, [columnMap, licenses, organizations, parsed]);

  const visible = validated.filter((row) => !row.skipped);
  const ready = visible.filter((row) => row.ready);
  const blocked = visible.filter((row) => !row.ready);
  const missingRequired = IMPORT_FIELDS.filter((field) => field.required && !columnMap[field.key]);

  async function loadBuffer(buffer: ArrayBuffer, name: string) {
    setError("");
    setSummary(null);
    try {
      const next = parseWorkbook(buffer);
      if (next.headers.length === 0) {
        setError("That workbook has no header row on the roster sheet.");
        return;
      }
      setParsed(next);
      setColumnMap(suggestColumnMap(next.headers));
      setFileName(name);
      setStep("Map");
    } catch {
      setError("The file could not be read. Use an .xlsx roster.");
    }
  }

  async function loadSample(href: string, name: string) {
    const response = await fetch(href);
    if (!response.ok) {
      setError("The sample file is missing from public/samples.");
      return;
    }
    await loadBuffer(await response.arrayBuffer(), name);
  }

  async function commit() {
    const rows = ready.flatMap((row) => (row.values ? [row.values] : []));
    try {
      const result = await importRows(rows);
      setSummary(result);
      setStep("Import");
      toast.success(`${result.licensesCreated} licenses added to the book`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "The import did not finish.");
    }
  }

  if (!isAdmin) return null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Intake"
        title={"A roster,\nchecked before it lands."}
        description="Map the client spreadsheet, block rows that would dirty the book, then add the ready rows. Samples are generated files in this repo, not a live board export."
      />

      <ol className="grid grid-cols-5 gap-2">
        {STEPS.map((item, index) => {
          const current = STEPS.indexOf(step);
          const state = index < current ? "done" : index === current ? "current" : "later";
          return (
            <li key={item} className="min-w-0">
              <div
                className={cn(
                  "mb-2 h-1 rounded-full",
                  state === "later" ? "bg-border" : "bg-primary",
                )}
              />
              <p className={cn("truncate text-xs", state === "current" ? "font-medium" : "text-muted-foreground")}>
                {index + 1}. {item}
              </p>
            </li>
          );
        })}
      </ol>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {step === "Source" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {SAMPLES.map((sample) => (
            <article key={sample.href} className="flex flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30">
              <h2 className="font-heading text-xl">{sample.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{sample.detail}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => loadSample(sample.href, sample.fileName)}>Use this file</Button>
                <a href={sample.href} className={buttonVariants({ variant: "outline" })} download>
                  Download
                </a>
              </div>
            </article>
          ))}
          <article className="flex flex-col rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30">
            <h2 className="font-heading text-xl">Your workbook</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
              Upload an .xlsx file with a header row. The sheet named like “roster” is read first.
            </p>
            <div className="mt-4 grid gap-1.5">
              <Label htmlFor="roster-file">Spreadsheet</Label>
              <input
                id="roster-file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="text-sm"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  await loadBuffer(await file.arrayBuffer(), file.name);
                }}
              />
            </div>
          </article>
        </div>
      ) : null}

      {step === "Map" && parsed ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-medium">Map columns</h2>
              <p className="text-sm text-muted-foreground">
                {fileName} · {parsed.sheetName} · {parsed.rows.length} data rows
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("Source")}>
                Back
              </Button>
              <Button disabled={missingRequired.length > 0} onClick={() => setStep("Validate")}>
                Validate rows
              </Button>
            </div>
          </div>
          {missingRequired.length > 0 ? (
            <p className="text-sm text-destructive">
              Still unmapped: {missingRequired.map((field) => field.label).join(", ")}.
            </p>
          ) : null}
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Book field</TableHead>
                  <TableHead>Spreadsheet column</TableHead>
                  <TableHead>Sample</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {IMPORT_FIELDS.map((field) => {
                  const header = columnMap[field.key];
                  const sample = parsed.rows.find((row) => header && row.cells[header])?.cells[header ?? ""];
                  return (
                    <TableRow key={field.key}>
                      <TableCell>
                        {field.label}
                        {field.required ? <span className="text-destructive"> *</span> : null}
                      </TableCell>
                      <TableCell>
                        <select
                          aria-label={`Column for ${field.label}`}
                          value={header ?? ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setColumnMap((current) => {
                              const next = { ...current };
                              if (!value) delete next[field.key];
                              else next[field.key] = value;
                              return next;
                            });
                          }}
                          className="h-8 w-full max-w-xs rounded-lg border border-input bg-transparent px-2 text-sm"
                        >
                          <option value="">{field.required ? "Choose a column" : "Ignore"}</option>
                          {parsed.headers.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="max-w-64 truncate text-muted-foreground">
                        {sample || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {step === "Validate" ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-medium">Validation</h2>
              <p className="text-sm text-muted-foreground">
                {ready.length} ready · {blocked.length} blocked ·{" "}
                {ready.filter((row) => row.issues.some((issue) => issue.level === "warning")).length} with warnings
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("Map")}>
                Back to mapping
              </Button>
              <Button disabled={ready.length === 0} onClick={() => setStep("Preview")}>
                Preview ready rows
              </Button>
            </div>
          </div>
          <IssueTable rows={visible} />
        </section>
      ) : null}

      {step === "Preview" ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-medium">Preview</h2>
              <p className="text-sm text-muted-foreground">
                {ready.length} licenses will be added. Existing pharmacies and locations are matched by name.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("Validate")}>
                Back
              </Button>
              <Button onClick={commit}>Import {ready.length} licenses</Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Pharmacy</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ready.map((row) => (
                  <TableRow key={row.rowNumber}>
                    <TableCell className="tabular-nums">{row.rowNumber}</TableCell>
                    <TableCell>{row.values?.organizationName}</TableCell>
                    <TableCell>{row.values?.locationName}</TableCell>
                    <TableCell>
                      {row.values?.licenseNumber}
                      <div className="text-xs text-muted-foreground">{row.values?.licenseType}</div>
                    </TableCell>
                    <TableCell className="capitalize">{row.values?.status}</TableCell>
                    <TableCell>{row.values?.expiresOn ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {step === "Import" && summary ? (
        <section className="rounded-2xl border border-border bg-card p-5" aria-live="polite">
          <h2 className="font-heading text-2xl">Roster added</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Summary label="Organizations created" value={summary.organizationsCreated} />
            <Summary label="Locations created" value={summary.locationsCreated} />
            <Summary label="Licenses added" value={summary.licensesCreated} />
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/licenses" className={buttonVariants()}>
              Open the license book
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                setParsed(null);
                setSummary(null);
                setStep("Source");
              }}
            >
              Import another file
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function IssueTable({ rows }: { rows: ValidatedRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Row</TableHead>
            <TableHead>Result</TableHead>
            <TableHead>Organization</TableHead>
            <TableHead>License</TableHead>
            <TableHead>Issues</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.rowNumber}>
              <TableCell className="tabular-nums">{row.rowNumber}</TableCell>
              <TableCell>{row.ready ? "Ready" : "Blocked"}</TableCell>
              <TableCell>{cell(row, "organizationName")}</TableCell>
              <TableCell>{cell(row, "licenseNumber")}</TableCell>
              <TableCell className="max-w-md">
                {row.issues.length === 0 ? (
                  <span className="text-muted-foreground">Clear</span>
                ) : (
                  <ul className="grid gap-1">
                    {row.issues.map((issue) => (
                      <li key={issue.message} className={issue.level === "error" ? "text-destructive" : "text-muted-foreground"}>
                        {issue.level === "warning" ? "Warning: " : ""}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function cell(row: ValidatedRow, key: "organizationName" | "licenseNumber") {
  return row.values?.[key] ?? "—";
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-accent px-3 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-heading text-3xl tabular-nums">{value}</dd>
    </div>
  );
}
