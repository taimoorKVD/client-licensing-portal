import * as XLSX from "xlsx";
import type { SheetRow } from "./validate";

export type ParsedWorkbook = {
  sheetName: string;
  headers: string[];
  rows: SheetRow[];
};

export function parseWorkbook(data: ArrayBuffer): ParsedWorkbook {
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName =
    workbook.SheetNames.find((name) => name.toLowerCase().includes("roster")) ??
    workbook.SheetNames[0];

  if (!sheetName) {
    return { sheetName: "", headers: [], rows: [] };
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  const headerRow = (matrix[0] ?? []).map((cell) => String(cell ?? "").trim());
  const headers = headerRow.filter((header) => header.length > 0);
  const rows: SheetRow[] = [];

  matrix.slice(1).forEach((line, index) => {
    const cells: Record<string, string> = {};
    headerRow.forEach((header, column) => {
      if (!header) return;
      cells[header] = String(line?.[column] ?? "").trim();
    });
    rows.push({ rowNumber: index + 2, cells });
  });

  return { sheetName, headers, rows };
}
