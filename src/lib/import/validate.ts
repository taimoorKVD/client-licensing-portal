import type { LicenseStatus } from "../domain";
import { IMPORT_FIELDS, type ColumnMap, type FieldKey } from "./fields";
import { normalizeState } from "./states";

export type SheetRow = {
  rowNumber: number;
  cells: Record<string, string>;
};

export type ImportIssue = {
  level: "error" | "warning";
  message: string;
};

export type MappedLicense = {
  organizationName: string;
  locationName: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  licenseNumber: string;
  licenseType: string;
  issuingAuthority: string;
  status: LicenseStatus;
  issuedOn: string | null;
  expiresOn: string | null;
  deaNumber: string;
  ncpdp: string;
  contactEmail: string;
  notes: string;
};

export type ValidatedRow = {
  rowNumber: number;
  values: MappedLicense | null;
  issues: ImportIssue[];
  ready: boolean;
  skipped: boolean;
};

export type ExistingLicenseKey = {
  organizationName: string;
  licenseNumber: string;
  issuingAuthority: string;
};

const STATUS_ALIASES: Record<string, { status: LicenseStatus; warning?: string }> = {
  active: { status: "active" },
  current: { status: "active" },
  "in good standing": { status: "active" },
  expiring: {
    status: "active",
    warning: "Expiring is calculated from the expiration date, so this row is stored as active.",
  },
  "expiring soon": {
    status: "active",
    warning: "Expiring is calculated from the expiration date, so this row is stored as active.",
  },
  pending: { status: "pending" },
  submitted: { status: "pending" },
  "in review": { status: "pending" },
  expired: { status: "expired" },
  lapsed: { status: "expired" },
  suspended: { status: "suspended" },
  inactive: {
    status: "suspended",
    warning: "Inactive was stored as suspended.",
  },
};

export function validateWorkbook(
  rows: SheetRow[],
  columnMap: ColumnMap,
  existing: ExistingLicenseKey[] = [],
): ValidatedRow[] {
  const missingColumns = IMPORT_FIELDS.filter((field) => field.required && !columnMap[field.key]);
  const seen = new Map<string, number>();
  const existingKeys = new Set(existing.map(licenseKey));

  return rows.map((row) => {
    if (isBlankRow(row, columnMap)) {
      return { rowNumber: row.rowNumber, values: null, issues: [], ready: false, skipped: true };
    }

    const issues: ImportIssue[] = [];
    for (const field of missingColumns) {
      issues.push({
        level: "error",
        message: `Map a column to ${field.label}.`,
      });
    }

    const read = (key: FieldKey) => {
      const header = columnMap[key];
      if (!header) return "";
      return (row.cells[header] ?? "").trim();
    };

    const organizationName = read("organizationName");
    const locationName = read("locationName");
    const licenseNumber = read("licenseNumber");
    const licenseType = read("licenseType");
    const issuingAuthority = read("issuingAuthority");
    const stateInput = read("state");
    const state = normalizeState(stateInput);
    const issuedRaw = read("issuedOn");
    const expiresRaw = read("expiresOn");
    const issuedOn = issuedRaw ? parseDate(issuedRaw) : null;
    const expiresOn = expiresRaw ? parseDate(expiresRaw) : null;
    const statusRaw = read("status");
    const email = read("contactEmail");
    const postalCode = read("postalCode");
    const deaNumber = read("deaNumber").toUpperCase();

    if (!organizationName) issues.push({ level: "error", message: "Organization is required." });
    if (!locationName) issues.push({ level: "error", message: "Location is required." });
    if (!licenseNumber) issues.push({ level: "error", message: "License number is required." });
    if (!licenseType) issues.push({ level: "error", message: "License type is required." });
    if (!issuingAuthority) issues.push({ level: "error", message: "Issuing authority is required." });
    if (!stateInput) issues.push({ level: "error", message: "State is required." });
    else if (!state) issues.push({ level: "error", message: `State "${stateInput}" is not a US state code.` });

    if (issuedRaw && !issuedOn) {
      issues.push({ level: "error", message: `Issue date "${issuedRaw}" is not a real date. Use YYYY-MM-DD or M/D/YYYY.` });
    }
    if (expiresRaw && !expiresOn) {
      issues.push({ level: "error", message: `Expiration date "${expiresRaw}" is not a real date. Use YYYY-MM-DD or M/D/YYYY.` });
    }
    if (issuedOn && expiresOn && expiresOn < issuedOn) {
      issues.push({ level: "error", message: "Expiration date is before the issue date." });
    }

    let status: LicenseStatus = "pending";
    if (!statusRaw) {
      issues.push({ level: "warning", message: "No status was provided, so the row will import as pending." });
    } else {
      const mapped = STATUS_ALIASES[statusRaw.toLowerCase()];
      if (!mapped) {
        issues.push({
          level: "error",
          message: `Status "${statusRaw}" is not recognized. Use active, pending, expired, or suspended.`,
        });
      } else {
        status = mapped.status;
        if (mapped.warning) issues.push({ level: "warning", message: mapped.warning });
      }
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push({ level: "error", message: `Email "${email}" is not valid.` });
    }
    if (postalCode && !/^\d{5}(-\d{4})?$/.test(postalCode)) {
      issues.push({ level: "warning", message: "Postal code is not a 5-digit or ZIP+4 code." });
    }
    if (deaNumber && !/^[A-Z]{2}\d{7}$/.test(deaNumber)) {
      issues.push({ level: "warning", message: "DEA number does not match the usual two letters and seven digits." });
    }

    const key = licenseKey({
      organizationName,
      licenseNumber,
      issuingAuthority,
    });
    if (organizationName && licenseNumber && issuingAuthority) {
      const previous = seen.get(key);
      if (previous) {
        issues.push({ level: "error", message: `Duplicate of row ${previous} in this file.` });
      } else {
        seen.set(key, row.rowNumber);
      }
      if (existingKeys.has(key)) {
        issues.push({
          level: "error",
          message: "This license number and issuing authority are already in the book for this organization.",
        });
      }
    }

    const ready = !issues.some((issue) => issue.level === "error") && Boolean(state);
    const values: MappedLicense = {
      organizationName,
      locationName,
      addressLine1: read("addressLine1"),
      city: read("city"),
      state: state ?? "",
      postalCode,
      licenseNumber,
      licenseType,
      issuingAuthority,
      status,
      issuedOn,
      expiresOn,
      deaNumber,
      ncpdp: read("ncpdp"),
      contactEmail: email,
      notes: read("notes"),
    };

    return { rowNumber: row.rowNumber, values, issues, ready, skipped: false };
  });
}

export function licenseKey(input: ExistingLicenseKey): string {
  return [input.organizationName, input.licenseNumber, input.issuingAuthority]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

function isBlankRow(row: SheetRow, columnMap: ColumnMap): boolean {
  return IMPORT_FIELDS.every((field) => {
    const header = columnMap[field.key];
    if (!header) return true;
    return (row.cells[header] ?? "").trim() === "";
  });
}

export function parseDate(value: string): string | null {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const us = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (us) return validDate(Number(us[3]), Number(us[1]), Number(us[2]));
  return null;
}

function validDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
