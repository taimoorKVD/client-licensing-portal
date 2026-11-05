import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cloneSeed } from "../seed";
import { commitImport } from "./commit";
import { suggestColumnMap } from "./fields";
import { validateWorkbook, type SheetRow } from "./validate";

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
  "Contact Email",
  "Notes",
];

function row(rowNumber: number, values: string[]): SheetRow {
  const cells: Record<string, string> = {};
  headers.forEach((header, index) => {
    cells[header] = values[index] ?? "";
  });
  return { rowNumber, cells };
}

const map = suggestColumnMap(headers);

describe("suggestColumnMap", () => {
  it("matches the sample roster headers", () => {
    assert.equal(map.organizationName, "Organization");
    assert.equal(map.licenseNumber, "License Number");
    assert.equal(map.expiresOn, "Expires On");
    assert.equal(map.postalCode, "Postal Code");
  });
});

describe("validateWorkbook", () => {
  const existing = [
    {
      organizationName: "Harbor & Pine Pharmacy",
      licenseNumber: "PH-WA-104482",
      issuingAuthority: "Washington State Board of Pharmacy",
    },
  ];

  it("accepts a clean row and warns when status is missing", () => {
    const [result] = validateWorkbook(
      [
        row(2, [
          "Redwood Coast Pharmacy",
          "Trinidad",
          "410 Main St",
          "Trinidad",
          "California",
          "95570",
          "PHY-44120",
          "State Pharmacy Permit",
          "California Board of Pharmacy",
          "",
          "2024-05-01",
          "2027-05-01",
          "",
          "ops@redwood.example",
          "",
        ]),
      ],
      map,
      existing,
    );
    assert.equal(result.ready, true);
    assert.equal(result.values?.state, "CA");
    assert.equal(result.values?.status, "pending");
    assert.equal(result.issues.some((issue) => issue.level === "warning"), true);
  });

  it("blocks bad dates, unknown status, duplicate rows, and licenses already on file", () => {
    const results = validateWorkbook(
      [
        row(2, ["Cedar & Main Pharmacy", "Main Street", "12 Main", "Eugene", "OR", "97401", "OR-100", "State Pharmacy Permit", "Oregon Board of Pharmacy", "Active", "2024-01-01", "2027-01-01", "AB1234567", "ada@cedar.example", ""]),
        row(3, ["Cedar & Main Pharmacy", "Main Street", "12 Main", "Eugene", "OR", "97401", "OR-100", "State Pharmacy Permit", "Oregon Board of Pharmacy", "Active", "2024-01-01", "2027-01-01", "", "ada@cedar.example", ""]),
        row(4, ["Cedar & Main Pharmacy", "Main Street", "12 Main", "Eugene", "ZZ", "974", "", "State Pharmacy Permit", "Oregon Board of Pharmacy", "TBD", "2027-02-01", "2024-01-01", "NOPE", "not-an-email", ""]),
        row(5, ["", "Main Street", "", "", "OR", "", "OR-9", "", "Oregon Board of Pharmacy", "Active", "13/40/2026", "", "", "", ""]),
        row(6, ["Harbor & Pine Pharmacy", "Ballard", "", "Seattle", "WA", "98107", "PH-WA-104482", "State Pharmacy Permit", "Washington State Board of Pharmacy", "Expiring soon", "2024-03-12", "2027-06-30", "", "", ""]),
        row(7, ["", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]),
      ],
      map,
      existing,
    );

    assert.equal(results[0].ready, true);
    assert.equal(results[1].ready, false);
    assert.match(results[1].issues.map((issue) => issue.message).join(" "), /Duplicate of row 2/);
    assert.equal(results[2].ready, false);
    const blocked = results[2].issues.map((issue) => issue.message).join(" ");
    assert.match(blocked, /ZZ/);
    assert.match(blocked, /License number is required/);
    assert.match(blocked, /TBD/);
    assert.match(blocked, /Expiration date is before/);
    assert.match(blocked, /not-an-email/);
    assert.equal(results[2].issues.some((issue) => issue.message.includes("DEA")), true);
    assert.equal(results[3].ready, false);
    assert.match(results[3].issues.map((issue) => issue.message).join(" "), /13\/40\/2026/);
    assert.equal(results[4].ready, false);
    assert.match(results[4].issues.map((issue) => issue.message).join(" "), /already in the book/i);
    assert.equal(results[5].skipped, true);
  });
});

describe("commitImport", () => {
  it("creates a pharmacy and attaches a row to an existing location", () => {
    const snapshot = cloneSeed();
    const validated = validateWorkbook(
      [
        row(2, ["Redwood Coast Pharmacy", "Trinidad", "410 Main St", "Trinidad", "CA", "95570", "PHY-44120", "State Pharmacy Permit", "California Board of Pharmacy", "Active", "2024-05-01", "2027-05-01", "FT4412091", "ops@redwood.example", ""]),
        row(3, ["Harbor & Pine Pharmacy", "Ballard", "5401 22nd Ave NW", "Seattle", "WA", "98107", "PH-WA-CLIA-229", "CLIA Certificate", "CMS", "Active", "2025-01-01", "2027-01-01", "", "elena.voss@harborandpine.example", ""]),
      ],
      map,
    );
    const ready = validated.flatMap((item) => (item.values ? [item.values] : []));
    let n = 0;
    const result = commitImport(snapshot, ready, {
      on: "2026-11-05",
      createId: (prefix) => `${prefix}_${++n}`,
    });

    assert.equal(result.summary.organizationsCreated, 1);
    assert.equal(result.summary.locationsCreated, 1);
    assert.equal(result.summary.licensesCreated, 2);
    assert.equal(snapshot.licenses.length + 2, result.snapshot.licenses.length);
    const harbor = result.snapshot.licenses.find((item) => item.licenseNumber === "PH-WA-CLIA-229");
    assert.equal(harbor?.organizationId, "org_harbor");
    assert.equal(harbor?.locationId, "loc_harbor_ballard");
    assert.equal(harbor?.source, "import");
    assert.equal(result.snapshot.activity[0]?.title, "Roster imported");
  });
});
