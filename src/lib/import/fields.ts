export const IMPORT_FIELDS = [
  {
    key: "organizationName",
    label: "Organization",
    required: true,
    aliases: ["organization", "organization name", "client", "client name", "pharmacy", "pharmacy name", "org"],
  },
  {
    key: "locationName",
    label: "Location",
    required: true,
    aliases: ["location", "location name", "site", "site name", "store"],
  },
  {
    key: "addressLine1",
    label: "Street address",
    required: false,
    aliases: ["street address", "address", "address line 1", "street", "address1"],
  },
  {
    key: "city",
    label: "City",
    required: false,
    aliases: ["city", "town"],
  },
  {
    key: "state",
    label: "State",
    required: true,
    aliases: ["state", "st"],
  },
  {
    key: "postalCode",
    label: "Postal code",
    required: false,
    aliases: ["postal code", "zip", "zip code", "postal"],
  },
  {
    key: "licenseNumber",
    label: "License number",
    required: true,
    aliases: ["license number", "license no", "license", "permit number", "permit no", "registration number"],
  },
  {
    key: "licenseType",
    label: "License type",
    required: true,
    aliases: ["license type", "type", "permit type", "credential type"],
  },
  {
    key: "issuingAuthority",
    label: "Issuing authority",
    required: true,
    aliases: ["issuing authority", "issuer", "board", "issuing board", "agency", "authority"],
  },
  {
    key: "status",
    label: "Status",
    required: false,
    aliases: ["status", "license status"],
  },
  {
    key: "issuedOn",
    label: "Issued on",
    required: false,
    aliases: ["issued on", "issue date", "issued", "effective date", "start date"],
  },
  {
    key: "expiresOn",
    label: "Expires on",
    required: false,
    aliases: ["expires on", "expiration date", "expiration", "expires", "expiry", "end date"],
  },
  {
    key: "deaNumber",
    label: "DEA number",
    required: false,
    aliases: ["dea number", "dea", "dea no"],
  },
  {
    key: "ncpdp",
    label: "NCPDP",
    required: false,
    aliases: ["ncpdp", "ncpdp number", "nabp"],
  },
  {
    key: "contactEmail",
    label: "Contact email",
    required: false,
    aliases: ["contact email", "email", "email address"],
  },
  {
    key: "notes",
    label: "Notes",
    required: false,
    aliases: ["notes", "note", "comments", "comment"],
  },
] as const;

export type FieldKey = (typeof IMPORT_FIELDS)[number]["key"];

export type ColumnMap = Partial<Record<FieldKey, string>>;

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/#/g, " number ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function suggestColumnMap(headers: string[]): ColumnMap {
  const normalizedHeaders = headers.map((header) => ({
    header,
    key: normalizeHeader(header),
  }));
  const used = new Set<string>();
  const map: ColumnMap = {};

  const ranked = IMPORT_FIELDS.flatMap((field) =>
    field.aliases.map((alias) => ({
      field: field.key,
      alias: normalizeHeader(alias),
      required: field.required,
    })),
  ).sort((a, b) => b.alias.length - a.alias.length);

  for (const candidate of ranked) {
    if (map[candidate.field]) continue;
    const match = normalizedHeaders.find(
      (header) => header.key === candidate.alias && !used.has(header.header),
    );
    if (!match) continue;
    map[candidate.field] = match.header;
    used.add(match.header);
  }

  return map;
}
