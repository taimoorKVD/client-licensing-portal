import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samplesDir = path.join(root, "public", "samples");

const headers = [
  "Organization",
  "Location",
  "Street Address",
  "City",
  "State",
  "Postal Code",
  "License Number",
  "License Type",
  "Issuing Authority",
  "Status",
  "Issued On",
  "Expires On",
  "DEA Number",
  "NCPDP",
  "Contact Email",
  "Notes",
];

const cleanRows = [
  ["Redwood Coast Pharmacy", "Trinidad", "410 Main St", "Trinidad", "CA", "95570", "PHY-44120", "State Pharmacy Permit", "California Board of Pharmacy", "Active", "2024-05-01", "2027-05-01", "FT4412091", "5612201", "ops@redwoodcoast.example", "Primary coastal counter"],
  ["Redwood Coast Pharmacy", "Trinidad", "410 Main St", "Trinidad", "CA", "95570", "FT4412091", "DEA Registration", "Drug Enforcement Administration", "Active", "2024-05-20", "2027-05-20", "FT4412091", "5612201", "ops@redwoodcoast.example", ""],
  ["Redwood Coast Pharmacy", "Arcata", "890 G St", "Arcata", "CA", "95521", "PHY-44188", "State Pharmacy Permit", "California Board of Pharmacy", "Active", "2024-06-12", "2027-06-12", "FT4418804", "5612218", "ops@redwoodcoast.example", ""],
  ["Redwood Coast Pharmacy", "Arcata", "890 G St", "Arcata", "CA", "95521", "FT4418804", "DEA Registration", "Drug Enforcement Administration", "Active", "2024-06-18", "2027-06-18", "FT4418804", "5612218", "ops@redwoodcoast.example", ""],
  ["Redwood Coast Pharmacy", "Arcata", "890 G St", "Arcata", "CA", "95521", "CS-CA-44188", "Controlled Substance Registration", "California Board of Pharmacy", "Active", "2024-06-12", "2027-06-12", "FT4418804", "5612218", "ops@redwoodcoast.example", ""],
];

const reviewRows = [
  ["Harbor & Pine Pharmacy", "Ballard", "5401 22nd Ave NW", "Seattle", "WA", "98107", "PH-WA-CLIA-229", "CLIA Certificate", "CMS", "Active", "2025-01-15", "2027-01-15", "", "4928811", "elena.voss@harborandpine.example", "Adds a certificate to an existing site"],
  ["Cedar & Main Pharmacy", "Main Street", "120 Main St", "Eugene", "OR", "97401", "OR-PH-3301", "State Pharmacy Permit", "Oregon Board of Pharmacy", "Active", "2024-02-01", "2027-02-01", "FO3301102", "3804411", "ada@cedarandmain.example", ""],
  ["Cedar & Main Pharmacy", "Main Street", "120 Main St", "Eugene", "OR", "97401", "FO3301102", "DEA Registration", "Drug Enforcement Administration", "Active", "2024-02-11", "2027-02-11", "FO3301102", "3804411", "ada@cedarandmain.example", ""],
  ["Cedar & Main Pharmacy", "Division Street", "44 Division Ave", "Eugene", "OR", "97404", "OR-PH-3308", "State Pharmacy Permit", "Oregon Board of Pharmacy", "Expiring soon", "2023-11-20", "2026-11-20", "FO3308801", "3804420", "ada@cedarandmain.example", "Status alias should import as active"],
  ["Cedar & Main Pharmacy", "Main Street", "120 Main St", "Eugene", "OR", "974", "OR-PH-BAD-1", "State Pharmacy Permit", "Oregon Board of Pharmacy", "Active", "2024-02-01", "2027-02-01", "NOT-A-DEA", "3804411", "ada@cedarandmain.example", "Postal and DEA warnings, still importable"],
  ["Cedar & Main Pharmacy", "Main Street", "120 Main St", "Eugene", "OR", "97401", "", "State Pharmacy Permit", "Oregon Board of Pharmacy", "Active", "2024-01-01", "2027-01-01", "", "", "ada@cedarandmain.example", "Missing license number"],
  ["Cedar & Main Pharmacy", "Main Street", "120 Main St", "Eugene", "ZZ", "97401", "OR-PH-3309", "State Pharmacy Permit", "Oregon Board of Pharmacy", "TBD", "2027-05-01", "2024-01-01", "", "", "not-an-email", "Bad state, status, dates, and email"],
  ["Cedar & Main Pharmacy", "Main Street", "120 Main St", "Eugene", "OR", "97401", "OR-PH-3301", "State Pharmacy Permit", "Oregon Board of Pharmacy", "Active", "2024-02-01", "2027-02-01", "", "", "ada@cedarandmain.example", "Duplicate of the first Cedar permit"],
  ["", "Main Street", "120 Main St", "Eugene", "OR", "97401", "OR-PH-3310", "", "Oregon Board of Pharmacy", "Active", "13/40/2026", "", "", "", "", "Missing organization and type, impossible date"],
  ["Harbor & Pine Pharmacy", "Ballard", "5401 22nd Ave NW", "Seattle", "WA", "98107", "PH-WA-104482", "State Pharmacy Permit", "Washington State Board of Pharmacy", "Active", "2024-03-12", "2027-06-30", "", "", "", "Already in the CML book"],
  ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];

await mkdir(samplesDir, { recursive: true });
await writeWorkbook(
  path.join(samplesDir, "cml-license-roster-clean.xlsx"),
  "Clean roster for Redwood Coast Pharmacy. Every row should pass validation.",
  cleanRows,
);
await writeWorkbook(
  path.join(samplesDir, "cml-license-roster-review.xlsx"),
  "Review roster. Some rows are ready, some are blocked, and one empty row should be skipped.",
  reviewRows,
);
await writeCertificate(path.join(samplesDir, "pharmacy-license-certificate.pdf"));

async function writeWorkbook(filePath, note, rows) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CML Client Licensing";
  workbook.created = new Date("2026-11-05T00:00:00Z");

  const roster = workbook.addWorksheet("License roster");
  roster.addRow(headers);
  for (const row of rows) roster.addRow(row);
  roster.views = [{ state: "frozen", ySplit: 1 }];
  roster.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
  roster.getRow(1).font = { bold: true, color: { argb: "FFF4E2B8" } };
  roster.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F4A42" },
  };
  const widths = [32, 18, 24, 16, 10, 14, 20, 36, 48, 16, 14, 14, 16, 14, 36, 42];
  widths.forEach((width, index) => {
    roster.getColumn(index + 1).width = width;
  });

  const notes = workbook.addWorksheet("How to use");
  notes.getColumn(1).width = 110;
  notes.addRow(["CML sample roster"]);
  notes.addRow([note]);
  notes.addRow(["Required fields: Organization, Location, State, License Number, License Type, Issuing Authority."]);
  notes.addRow(["Dates accept YYYY-MM-DD or M/D/YYYY. Status accepts Active, Pending, Expired, Suspended, and a few aliases."]);
  notes.addRow(["This workbook is fictional demonstration data for the CML portal."]);
  notes.getRow(1).font = { bold: true, size: 16 };

  await workbook.xlsx.writeFile(filePath);
}

async function writeCertificate(filePath) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const ink = rgb(0.16, 0.27, 0.24);
  const brass = rgb(0.62, 0.46, 0.22);
  const muted = rgb(0.33, 0.32, 0.28);

  page.drawRectangle({
    x: 28,
    y: 28,
    width: 556,
    height: 736,
    borderColor: ink,
    borderWidth: 1.5,
  });
  page.drawRectangle({
    x: 36,
    y: 36,
    width: 540,
    height: 720,
    borderColor: brass,
    borderWidth: 0.6,
  });

  page.drawText("SAMPLE", {
    x: 230,
    y: 430,
    size: 52,
    font: serifBold,
    color: rgb(0.85, 0.78, 0.62),
    rotate: degrees(18),
  });

  page.drawText("CML CLIENT LICENSING", {
    x: 186,
    y: 700,
    size: 11,
    font: serif,
    color: brass,
  });
  page.drawText("Certificate of Licensure", {
    x: 150,
    y: 650,
    size: 28,
    font: serifBold,
    color: ink,
  });
  page.drawText("Demonstration copy. Not a government document.", {
    x: 168,
    y: 622,
    size: 11,
    font: serif,
    color: muted,
  });

  const lines = [
    ["Pharmacy", "Harbor & Pine Pharmacy, LLC"],
    ["Location", "Ballard · 5401 22nd Ave NW, Seattle, WA 98107"],
    ["License number", "PH-WA-104482"],
    ["License type", "State Pharmacy Permit"],
    ["Issuing authority", "Washington State Board of Pharmacy"],
    ["Issued", "March 12, 2024"],
    ["Expires", "June 30, 2027"],
    ["Status in the book", "Active"],
  ];

  lines.forEach(([label, value], index) => {
    const y = 560 - index * 36;
    page.drawText(label.toUpperCase(), {
      x: 84,
      y: y + 14,
      size: 8,
      font: serif,
      color: brass,
    });
    page.drawText(value, {
      x: 84,
      y,
      size: 13,
      font: serif,
      color: ink,
    });
  });

  page.drawText("Prepared for the CML demo book on November 5, 2026.", {
    x: 150,
    y: 78,
    size: 10,
    font: serif,
    color: muted,
  });

  const bytes = await pdf.save();
  await writeFile(filePath, bytes);
}
