/**
 * Authorization rules for CML staff and pharmacy tenants.
 *
 * The database policies in supabase/migrations enforce the same rules.
 * Nothing in this file reads user_metadata or app_metadata. Roles live in
 * tables, and the protected super admin is an email plus a locked row.
 */

export const PROTECTED_SUPER_ADMIN_EMAIL = "hello@taimoorhussain.com";

export const ACCESS_SCOPES = ["staff", "tenant"] as const;
export type AccessScope = (typeof ACCESS_SCOPES)[number];

export const STAFF_PERMISSIONS = [
  "staff.organizations.read",
  "staff.organizations.write",
  "staff.locations.read",
  "staff.locations.write",
  "staff.licenses.read",
  "staff.licenses.write",
  "staff.licenses.import",
  "staff.documents.read",
  "staff.documents.write",
  "staff.users.read",
  "staff.users.manage",
  "staff.roles.manage",
  "staff.audit.read",
] as const;

export const TENANT_PERMISSIONS = [
  "tenant.organizations.read",
  "tenant.locations.read",
  "tenant.licenses.read",
  "tenant.documents.read",
] as const;

export const ALL_PERMISSIONS = [...STAFF_PERMISSIONS, ...TENANT_PERMISSIONS] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];
export type TenantPermission = (typeof TENANT_PERMISSIONS)[number];
export type Permission = StaffPermission | TenantPermission;

export const PERMISSION_LABEL: Record<Permission, string> = {
  "staff.organizations.read": "View all pharmacies",
  "staff.organizations.write": "Edit pharmacies",
  "staff.locations.read": "View all locations",
  "staff.locations.write": "Edit locations",
  "staff.licenses.read": "View the license book",
  "staff.licenses.write": "Update licenses",
  "staff.licenses.import": "Import rosters",
  "staff.documents.read": "View all documents",
  "staff.documents.write": "Manage documents",
  "staff.users.read": "View accounts",
  "staff.users.manage": "Create and assign accounts",
  "staff.roles.manage": "Edit roles",
  "staff.audit.read": "View the audit trail",
  "tenant.organizations.read": "View own pharmacy",
  "tenant.locations.read": "View own locations",
  "tenant.licenses.read": "View own licenses",
  "tenant.documents.read": "View own documents",
};

const STAFF_PERMISSION_SET = new Set<string>(STAFF_PERMISSIONS);
const TENANT_PERMISSION_SET = new Set<string>(TENANT_PERMISSIONS);
const ALL_PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

export const SYSTEM_ROLE_SLUGS = [
  "super_admin",
  "cml_operator",
  "pharmacy_admin",
  "pharmacy_viewer",
] as const;

export type ActorKind = "staff" | "tenant";
export type AssuranceLevel = "aal1" | "aal2";
export type MfaStep = "enroll" | "challenge" | "ready";

export type PortalActor = {
  userId: string;
  email: string;
  displayName: string;
  kind: ActorKind;
  roleSlug: string;
  roleName: string;
  organizationIds: string[];
  organizationName: string | null;
  permissions: Permission[];
  protected: boolean;
};

export type Guard = { ok: true } | { ok: false; error: string };

export function isPermission(value: string): value is Permission {
  return ALL_PERMISSION_SET.has(value);
}

export function permissionsForScope(scope: AccessScope): readonly Permission[] {
  return scope === "staff" ? STAFF_PERMISSIONS : TENANT_PERMISSIONS;
}

export function isProtectedSuperAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === PROTECTED_SUPER_ADMIN_EMAIL;
}

export function hasPermission(
  actor: { permissions: readonly string[] },
  permission: Permission,
): boolean {
  return actor.permissions.includes(permission);
}

/**
 * Staff must enroll TOTP before any book data is available.
 * Supabase only raises nextLevel to aal2 after a factor is verified, so the
 * first sign-in is an enrollment step, not a challenge.
 * A pharmacy user who has verified a factor must challenge on later sign-ins.
 */
export function mfaGate(input: {
  kind: ActorKind;
  verifiedFactorCount: number;
  currentLevel: AssuranceLevel | null;
}): MfaStep {
  const staffRequired = input.kind === "staff";
  const optedIn = input.verifiedFactorCount > 0;
  if (!staffRequired && !optedIn) return "ready";
  if (input.currentLevel === "aal2") return "ready";
  if (input.verifiedFactorCount === 0) return "enroll";
  return "challenge";
}

export function mfaPath(step: MfaStep): "/login/mfa/enroll" | "/login/mfa/challenge" | "/" {
  if (step === "enroll") return "/login/mfa/enroll";
  if (step === "challenge") return "/login/mfa/challenge";
  return "/";
}

export type ProtectedStaffAction = "delete" | "demote" | "disable" | "change_role" | "change_email";

export function guardProtectedStaff(input: {
  email: string;
  protected: boolean;
  action: ProtectedStaffAction;
}): Guard {
  if (!input.protected && !isProtectedSuperAdminEmail(input.email)) return { ok: true };
  const reasons: Record<ProtectedStaffAction, string> = {
    delete: "The protected super admin cannot be deleted.",
    demote: "The protected super admin cannot be demoted.",
    disable: "The protected super admin cannot be disabled.",
    change_role: "The protected super admin cannot change roles.",
    change_email: "The protected super admin email cannot be changed.",
  };
  return { ok: false, error: reasons[input.action] };
}

export function guardCreateUserEmail(email: string): Guard {
  if (!isProtectedSuperAdminEmail(email)) return { ok: true };
  return {
    ok: false,
    error:
      "That email is reserved for the protected super admin. Create the Auth user in the Supabase dashboard, then run the bootstrap function. Do not set the password here.",
  };
}

export function canReadOrganization(
  actor: Pick<PortalActor, "kind" | "organizationIds" | "permissions">,
  organizationId: string,
): boolean {
  if (actor.kind === "staff") {
    return (
      hasPermission(actor, "staff.organizations.read") ||
      hasPermission(actor, "staff.licenses.read")
    );
  }
  if (!actor.organizationIds.includes(organizationId)) return false;
  return (
    hasPermission(actor, "tenant.organizations.read") ||
    hasPermission(actor, "tenant.licenses.read")
  );
}

/** Staff with the permission see every row the query returned. Tenants stay inside their organizations. */
export function rowsVisibleTo<T extends { organizationId: string }>(
  actor: Pick<PortalActor, "kind" | "organizationIds" | "permissions">,
  rows: readonly T[],
  permission: Permission,
): T[] {
  if (!hasPermission(actor, permission)) return [];
  if (actor.kind === "staff") {
    const staffPermission = permission.startsWith("staff.");
    return staffPermission ? [...rows] : [];
  }
  if (!permission.startsWith("tenant.")) return [];
  const allowed = new Set(actor.organizationIds);
  return rows.filter((row) => allowed.has(row.organizationId));
}

export function canWriteLicenses(actor: Pick<PortalActor, "kind" | "permissions">): boolean {
  return actor.kind === "staff" && hasPermission(actor, "staff.licenses.write");
}

export function canImportRoster(actor: Pick<PortalActor, "kind" | "permissions">): boolean {
  return actor.kind === "staff" && hasPermission(actor, "staff.licenses.import");
}

export function assertPermissionList(scope: AccessScope, keys: readonly string[]): Guard {
  const allowed = scope === "staff" ? STAFF_PERMISSION_SET : TENANT_PERMISSION_SET;
  if (keys.length === 0) return { ok: false, error: "A role needs at least one permission." };
  const unique = new Set(keys);
  if (unique.size !== keys.length) return { ok: false, error: "Permissions must be unique." };
  for (const key of keys) {
    if (!allowed.has(key)) {
      return { ok: false, error: "That permission is outside this role's scope." };
    }
  }
  return { ok: true };
}

export function guardRoleEdit(
  role: { slug: string; scope: AccessScope; system: boolean; protected: boolean },
  change: {
    delete?: boolean;
    slug?: string;
    scope?: AccessScope;
    permissions?: readonly string[];
  },
): Guard {
  if (change.delete) {
    if (role.protected || role.slug === "super_admin") {
      return { ok: false, error: "The super admin role cannot be deleted." };
    }
    if (role.system) return { ok: false, error: "System roles cannot be deleted." };
    return { ok: true };
  }
  if (change.slug !== undefined && change.slug !== role.slug) {
    if (role.system || role.protected) {
      return { ok: false, error: "System role slugs are fixed." };
    }
  }
  if (change.scope !== undefined && change.scope !== role.scope) {
    if (role.system || role.protected) {
      return { ok: false, error: "System role scope is fixed." };
    }
  }
  if (change.permissions) {
    if (role.protected || role.slug === "super_admin") {
      return { ok: false, error: "Super admin permissions cannot be changed." };
    }
    return assertPermissionList(change.scope ?? role.scope, change.permissions);
  }
  return { ok: true };
}

export function slugifyRoleName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug;
}
