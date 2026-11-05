/**
 * Server-side access decisions. These mirror the database triggers and RLS
 * policies so service-role calls (which bypass RLS) are refused before they
 * run. The database remains the authority for user-scoped queries.
 * Nothing in this module reads user_metadata.
 */

import {
  PHARMACY_ADMIN_PERMISSIONS,
  PROTECTED_ADMIN_EMAIL,
  STAFF_PERMISSIONS,
  permissionScope,
  type ActorKind,
  type PermissionKey,
} from "@/lib/auth/catalog";

export type Assurance = "aal1" | "aal2";

export type Principal = {
  userId: string;
  email: string;
  actorKind: ActorKind;
  permissions: readonly string[];
  organizationIds: readonly string[];
  protectedAdmin: boolean;
  disabled: boolean;
  aal: Assurance;
  roleId: string | null;
};

export type RoleDefinition = {
  id: string;
  key: string;
  scope: ActorKind;
  protected: boolean;
  system: boolean;
  permissions: readonly string[];
};

export type DirectoryUser = {
  userId: string;
  email: string;
  actorKind: ActorKind;
  roleId: string;
  roleKey: string;
  organizationId: string | null;
  protectedAdmin: boolean;
  disabled: boolean;
};

export type Decision = { ok: true } | { ok: false; message: string };

const BOOK_STAFF_PERMISSIONS = [
  "organizations.read",
  "organizations.write",
  "locations.read",
  "locations.write",
  "licenses.read",
  "licenses.write",
  "licenses.import",
  "documents.read",
  "documents.write",
  "users.manage",
] as const satisfies readonly PermissionKey[];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$/;
const SECRET_METADATA = /password|secret|token|cookie/i;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isProtectedAdminEmail(email: string): boolean {
  return normalizeEmail(email) === PROTECTED_ADMIN_EMAIL;
}

export function sessionSatisfiesMfa(principal: Principal): boolean {
  if (principal.disabled) return false;
  if (principal.actorKind === "tenant") return true;
  return principal.aal === "aal2";
}

export function holds(
  principal: Principal,
  permission: string,
  organizationId?: string | null,
): boolean {
  if (!sessionSatisfiesMfa(principal)) return false;
  const scope = permissionScope(permission);
  if (!scope || !principal.permissions.includes(permission)) return false;
  if (principal.actorKind === "staff") return scope === "staff";
  if (scope !== "tenant" || !organizationId) return false;
  return principal.organizationIds.includes(organizationId);
}

export function canReadOrganization(principal: Principal, organizationId: string): boolean {
  if (!sessionSatisfiesMfa(principal)) return false;
  if (principal.actorKind === "staff") {
    return BOOK_STAFF_PERMISSIONS.some((permission) => principal.permissions.includes(permission));
  }
  return holds(principal, "org.records.read", organizationId);
}

export function canWriteLicense(principal: Principal): boolean {
  return holds(principal, "licenses.write");
}

export function canImportRoster(principal: Principal): boolean {
  return holds(principal, "licenses.import");
}

export function canManagePeople(principal: Principal, organizationId?: string | null): boolean {
  if (principal.actorKind === "staff") return holds(principal, "users.manage");
  return holds(principal, "org.users.manage", organizationId);
}

export function validateNewPassword(password: string): Decision {
  if (!PASSWORD_PATTERN.test(password)) {
    return {
      ok: false,
      message: "Use at least 12 characters with an uppercase letter, a lowercase letter, and a digit.",
    };
  }
  return { ok: true };
}

export function validateEmail(email: string): Decision {
  if (!EMAIL_PATTERN.test(normalizeEmail(email))) {
    return { ok: false, message: "Enter a valid email address." };
  }
  return { ok: true };
}

export function assertAuditMetadata(metadata: Record<string, unknown>): Decision {
  for (const key of Object.keys(metadata)) {
    if (SECRET_METADATA.test(key)) {
      return { ok: false, message: "Refusing to store a secret in the audit log." };
    }
  }
  return { ok: true };
}

function mfaDecision(principal: Principal): Decision | null {
  if (principal.disabled) return { ok: false, message: "This account is disabled." };
  if (!sessionSatisfiesMfa(principal)) {
    return { ok: false, message: "Staff accounts must finish authenticator verification first." };
  }
  return null;
}

function canAssign(principal: Principal, role: RoleDefinition, organizationId: string | null): Decision {
  if (role.scope === "staff") {
    if (!holds(principal, "users.manage")) {
      return { ok: false, message: "You cannot assign CML staff roles." };
    }
    const missing = role.permissions.filter(
      (permission) => permissionScope(permission) === "staff" && !principal.permissions.includes(permission),
    );
    if (missing.length > 0) {
      return { ok: false, message: "You cannot grant a staff permission you do not hold." };
    }
    return { ok: true };
  }

  if (!organizationId) {
    return { ok: false, message: "A pharmacy user must belong to one pharmacy." };
  }
  if (principal.actorKind === "staff") {
    if (!holds(principal, "users.manage")) {
      return { ok: false, message: "You cannot assign pharmacy roles." };
    }
    return { ok: true };
  }
  if (!holds(principal, "org.users.manage", organizationId)) {
    return { ok: false, message: "You can only manage people in your pharmacy." };
  }
  const missing = role.permissions.filter(
    (permission) =>
      permissionScope(permission) === "tenant" && !principal.permissions.includes(permission),
  );
  if (missing.length > 0) {
    return { ok: false, message: "You cannot grant a pharmacy permission you do not hold." };
  }
  return { ok: true };
}

export function evaluateCreateUser(
  principal: Principal,
  input: {
    email: string;
    displayName: string;
    password: string;
    actorKind: ActorKind;
    role: RoleDefinition;
    organizationId: string | null;
  },
): Decision {
  const blocked = mfaDecision(principal);
  if (blocked) return blocked;
  const email = validateEmail(input.email);
  if (!email.ok) return email;
  if (isProtectedAdminEmail(input.email)) {
    return {
      ok: false,
      message: "hello@redtamarosan.com is reserved for the protected super admin bootstrap.",
    };
  }
  const password = validateNewPassword(input.password);
  if (!password.ok) return password;
  const displayName = input.displayName.trim();
  if (displayName.length < 1 || displayName.length > 80) {
    return { ok: false, message: "Enter a display name." };
  }
  if (input.role.scope !== input.actorKind) {
    return { ok: false, message: "Staff and pharmacy accounts stay in their own directory." };
  }
  if (input.actorKind === "staff" && input.organizationId) {
    return { ok: false, message: "CML staff are not members of a pharmacy." };
  }
  if (principal.actorKind === "tenant" && input.actorKind === "staff") {
    return { ok: false, message: "A pharmacy user cannot create CML staff." };
  }
  return canAssign(principal, input.role, input.organizationId);
}

export function evaluateAssignRole(
  principal: Principal,
  target: DirectoryUser,
  role: RoleDefinition,
): Decision {
  const blocked = mfaDecision(principal);
  if (blocked) return blocked;
  if (target.userId === principal.userId) {
    return { ok: false, message: "You cannot change your own role." };
  }
  if (target.protectedAdmin || isProtectedAdminEmail(target.email)) {
    return { ok: false, message: "The protected super admin cannot be demoted." };
  }
  if (role.scope !== target.actorKind) {
    return { ok: false, message: "Staff and pharmacy accounts stay in their own directory." };
  }
  return canAssign(principal, role, target.organizationId);
}

export function evaluateSetDisabled(
  principal: Principal,
  target: DirectoryUser,
  disabled: boolean,
): Decision {
  const blocked = mfaDecision(principal);
  if (blocked) return blocked;
  if (!disabled) {
    if (target.actorKind === "staff" && !holds(principal, "users.manage")) {
      return { ok: false, message: "You cannot enable this account." };
    }
    if (target.actorKind === "tenant" && !canManagePeople(principal, target.organizationId)) {
      return { ok: false, message: "You cannot enable this account." };
    }
    return { ok: true };
  }
  if (target.userId === principal.userId) {
    return { ok: false, message: "You cannot disable your own account." };
  }
  if (target.protectedAdmin || isProtectedAdminEmail(target.email)) {
    return { ok: false, message: "The protected super admin cannot be disabled." };
  }
  if (target.actorKind === "tenant") {
    if (!canManagePeople(principal, target.organizationId)) {
      return { ok: false, message: "You can only manage people in your pharmacy." };
    }
    return { ok: true };
  }
  if (principal.actorKind !== "staff" || !holds(principal, "users.manage")) {
    return { ok: false, message: "You cannot disable CML staff." };
  }
  return { ok: true };
}

export function evaluateDeleteUser(principal: Principal, target: DirectoryUser): Decision {
  const decision = evaluateSetDisabled(principal, target, true);
  if (!decision.ok && decision.message === "The protected super admin cannot be disabled.") {
    return { ok: false, message: "The protected super admin cannot be deleted." };
  }
  if (!decision.ok && decision.message === "You cannot disable your own account.") {
    return { ok: false, message: "You cannot delete your own account." };
  }
  return decision;
}

export function evaluateRoleEdit(
  principal: Principal,
  role: RoleDefinition,
  next: { name: string; description: string; permissions: readonly string[] },
): Decision {
  const blocked = mfaDecision(principal);
  if (blocked) return blocked;
  if (!holds(principal, "roles.manage")) {
    return { ok: false, message: "You cannot edit roles." };
  }
  if (role.protected) {
    return { ok: false, message: "The super admin role cannot be edited." };
  }
  if (role.id === principal.roleId) {
    return { ok: false, message: "You cannot edit your own role." };
  }
  const name = next.name.trim();
  if (name.length < 1 || name.length > 80) {
    return { ok: false, message: "Enter a role name." };
  }
  if (next.permissions.length === 0) {
    return { ok: false, message: "Choose at least one permission." };
  }
  for (const permission of next.permissions) {
    if (permissionScope(permission) !== role.scope) {
      return { ok: false, message: "A role can only include permissions from its own scope." };
    }
    if (role.scope === "staff" && !principal.permissions.includes(permission)) {
      return { ok: false, message: "You cannot grant a staff permission you do not hold." };
    }
  }
  return { ok: true };
}

export function evaluateRoleDelete(principal: Principal, role: RoleDefinition): Decision {
  const blocked = mfaDecision(principal);
  if (blocked) return blocked;
  if (!holds(principal, "roles.manage")) {
    return { ok: false, message: "You cannot delete roles." };
  }
  if (role.system || role.protected) {
    return { ok: false, message: "System roles cannot be deleted." };
  }
  if (role.id === principal.roleId) {
    return { ok: false, message: "You cannot delete your own role." };
  }
  return { ok: true };
}

export function protectedAdminsRemaining(
  users: readonly { userId: string; protectedAdmin: boolean; roleKey: string }[],
  removedUserId: string,
): number {
  return users.filter((user) => user.protectedAdmin && user.roleKey === "super_admin" && user.userId !== removedUserId)
    .length;
}

export const PHARMACY_ADMIN_PERMISSION_LIST: readonly string[] = PHARMACY_ADMIN_PERMISSIONS;
export const ALL_STAFF_PERMISSIONS: readonly string[] = STAFF_PERMISSIONS;
