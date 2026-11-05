import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { seedSnapshot } from "../src/lib/seed";

function uuidFor(id: string): string {
  const hex = createHash("sha256").update(`cml:${id}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function sqlString(value: string | null): string {
  if (value === null) return "null";
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlDate(value: string | null): string {
  return value ? `'${value}'` : "null";
}

const lines: string[] = [];
lines.push("-- Generated from src/lib/seed.ts by scripts/emit-seed.ts.");
lines.push("-- Fictional pharmacies for local `supabase db reset`. No auth users are created.");
lines.push("begin;");

for (const organization of seedSnapshot.organizations) {
  lines.push(
    `insert into public.organizations (id, name, legal_name, npi, status, city, state, primary_contact, contact_email, client_since) values (${sqlString(uuidFor(organization.id))}, ${sqlString(organization.name)}, ${sqlString(organization.legalName)}, ${sqlString(organization.npi)}, '${organization.status}', ${sqlString(organization.city)}, ${sqlString(organization.state)}, ${sqlString(organization.primaryContact)}, ${sqlString(organization.contactEmail)}, ${sqlDate(organization.since)});`,
  );
}

for (const location of seedSnapshot.locations) {
  lines.push(
    `insert into public.locations (id, organization_id, name, address_line1, address_line2, city, state, postal_code, phone, dea_number, ncpdp, status) values (${sqlString(uuidFor(location.id))}, ${sqlString(uuidFor(location.organizationId))}, ${sqlString(location.name)}, ${sqlString(location.addressLine1)}, ${sqlString(location.addressLine2)}, ${sqlString(location.city)}, ${sqlString(location.state)}, ${sqlString(location.postalCode)}, ${sqlString(location.phone)}, ${sqlString(location.deaNumber)}, ${sqlString(location.ncpdp)}, '${location.status}');`,
  );
}

for (const license of seedSnapshot.licenses) {
  lines.push(
    `insert into public.licenses (id, organization_id, location_id, license_number, license_type, issuing_authority, state, status, issued_on, expires_on, holder_name, notes) values (${sqlString(uuidFor(license.id))}, ${sqlString(uuidFor(license.organizationId))}, ${license.locationId ? sqlString(uuidFor(license.locationId)) : "null"}, ${sqlString(license.licenseNumber)}, ${sqlString(license.licenseType)}, ${sqlString(license.issuingAuthority)}, ${sqlString(license.state)}, '${license.status}', ${sqlDate(license.issuedOn)}, ${sqlDate(license.expiresOn)}, ${sqlString(license.holderName)}, ${sqlString(license.notes)});`,
  );
}

for (const document of seedSnapshot.documents) {
  const storagePath = document.href ? document.href.replace(/^\//, "") : null;
  lines.push(
    `insert into public.documents (id, organization_id, license_id, title, kind, file_name, mime_type, storage_path, uploaded_on) values (${sqlString(uuidFor(document.id))}, ${sqlString(uuidFor(document.organizationId))}, ${sqlString(uuidFor(document.licenseId))}, ${sqlString(document.title)}, '${document.kind}', ${sqlString(document.fileName)}, ${sqlString(document.mimeType)}, ${sqlString(storagePath)}, ${sqlDate(document.uploadedOn)});`,
  );
}

lines.push("commit;");
lines.push("");

const destination = path.join(process.cwd(), "supabase", "seed.sql");
writeFileSync(destination, lines.join("\n"));
console.log(`Wrote ${destination}`);
