/**
 * Permission catalog enforced by the app and by Row Level Security.
 * Roles are bundles of these keys. Authorization never reads user_metadata.
 */

export const PROTECTED_ADMIN_EMAIL = "hello@redtamarosan.com";

export const SUPER_ADMIN_ROLE_ID = "11111111-1111-4111-8111-111111111111";
export const OPERATOR_ROLE_ID = "22222222-2222-4222-8222-222222222222";
export const VIEWER_ROLE_ID = "33333333-3333-4333-8333-333333333333";
export const PHARMACY_ADMIN_ROLE_ID = "44444444-4444-4444-8444-444444444444";
export const PHARMACY_VIEWER_ROLE_ID = "55555555-5555-4555-8555-555555555555";

export type ActorKind = "staff" | "tenant";

export type PermissionDefinition = {
  key: string;
  scope: ActorKind;
  label: string;
  description: string;
};

export const PERMISSIONS = [
  {
    key: "organizations.read",
    scope: "staff",
    label: "View organizations",
    description: "See every pharmacy organization.",
  },
  {
    key: "organizations.write",
    scope: "staff",
    label: "Edit organizations",
    description: "Create and update pharmacy organizations.",
  },
  {
    key: "locations.read",
    scope: "staff",
    label: "View locations",
    description: "See every pharmacy location.",
  },
  {
    key: "locations.write",
    scope: "staff",
    label: "Edit locations",
    description: "Create and update pharmacy locations.",
  },
  {
    key: "licenses.read",
    scope: "staff",
    label: "View licenses",
    description: "See the full license book.",
  },
  {
    key: "licenses.write",
    scope: "staff",
    label: "Edit licenses",
    description: "Change license records and stored status.",
  },
  {
    key: "licenses.import",
    scope: "staff",
    label: "Import rosters",
    description: "Add organizations, locations, and licenses from a roster.",
  },
  {
    key: "documents.read",
    scope: "staff",
    label: "View documents",
    description: "See license documents for every pharmacy.",
  },
  {
    key: "documents.write",
    scope: "staff",
    label: "Edit documents",
    description: "Upload, replace, and remove license documents.",
  },
  {
    key: "users.read",
    scope: "staff",
    label: "View people",
    description: "See CML staff and pharmacy users.",
  },
  {
    key: "users.manage",
    scope: "staff",
    label: "Manage people",
    description: "Create users and assign roles the actor already holds.",
  },
  {
    key: "roles.read",
    scope: "staff",
    label: "View roles",
    description: "See staff and pharmacy roles.",
  },
  {
    key: "roles.manage",
    scope: "staff",
    label: "Manage roles",
    description: "Create and edit roles without granting permissions the actor lacks.",
  },
  {
    key: "audit.read",
    scope: "staff",
    label: "View audit",
    description: "Read the append-only audit trail.",
  },
  {
    key: "org.records.read",
    scope: "tenant",
    label: "View pharmacy book",
    description: "See this pharmacy's organizations, locations, licenses, and documents.",
  },
  {
    key: "org.users.read",
    scope: "tenant",
    label: "View pharmacy people",
    description: "See users in this pharmacy.",
  },
  {
    key: "org.users.manage",
    scope: "tenant",
    label: "Manage pharmacy people",
    description: "Create and assign pharmacy users inside this pharmacy.",
  },
] as const satisfies readonly PermissionDefinition[];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export const STAFF_PERMISSIONS = PERMISSIONS.filter((item) => item.scope === "staff").map(
  (item) => item.key,
);

export const TENANT_PERMISSIONS = PERMISSIONS.filter((item) => item.scope === "tenant").map(
  (item) => item.key,
);

export const OPERATOR_PERMISSIONS = [
  "organizations.read",
  "organizations.write",
  "locations.read",
  "locations.write",
  "licenses.read",
  "licenses.write",
  "licenses.import",
  "documents.read",
  "documents.write",
  "audit.read",
] as const satisfies readonly PermissionKey[];

export const VIEWER_PERMISSIONS = [
  "organizations.read",
  "locations.read",
  "licenses.read",
  "documents.read",
  "users.read",
  "roles.read",
  "audit.read",
] as const satisfies readonly PermissionKey[];

export const PHARMACY_ADMIN_PERMISSIONS = [
  "org.records.read",
  "org.users.read",
  "org.users.manage",
] as const satisfies readonly PermissionKey[];

export const PHARMACY_VIEWER_PERMISSIONS = [
  "org.records.read",
] as const satisfies readonly PermissionKey[];

const permissionScopes = new Map(PERMISSIONS.map((item) => [item.key, item.scope]));

export function permissionScope(key: string): ActorKind | null {
  return permissionScopes.get(key as PermissionKey) ?? null;
}

export function isPermissionKey(key: string): key is PermissionKey {
  return permissionScopes.has(key as PermissionKey);
}
