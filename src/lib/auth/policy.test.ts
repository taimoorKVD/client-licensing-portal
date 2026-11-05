import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OPERATOR_PERMISSIONS,
  PHARMACY_ADMIN_PERMISSIONS,
  PHARMACY_VIEWER_PERMISSIONS,
  PROTECTED_ADMIN_EMAIL,
  STAFF_PERMISSIONS,
  SUPER_ADMIN_ROLE_ID,
  VIEWER_PERMISSIONS,
} from "@/lib/auth/catalog";
import {
  assertAuditMetadata,
  canImportRoster,
  canReadOrganization,
  canWriteLicense,
  evaluateAssignRole,
  evaluateCreateUser,
  evaluateDeleteUser,
  evaluateRoleDelete,
  evaluateRoleEdit,
  evaluateSetDisabled,
  protectedAdminsRemaining,
  sessionSatisfiesMfa,
  type DirectoryUser,
  type Principal,
  type RoleDefinition,
} from "@/lib/auth/policy";

const HARBOR = "2c8df56d-3a03-4ca0-adba-93c480874bdb";
const MESA = "248557d9-29e0-4ef0-a42a-42c87976dc99";

function principal(overrides: Partial<Principal> = {}): Principal {
  return {
    userId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    email: "ada@cml.example",
    actorKind: "staff",
    permissions: STAFF_PERMISSIONS,
    organizationIds: [],
    protectedAdmin: false,
    disabled: false,
    aal: "aal2",
    roleId: SUPER_ADMIN_ROLE_ID,
    ...overrides,
  };
}

function role(overrides: Partial<RoleDefinition> = {}): RoleDefinition {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    key: "custom",
    scope: "staff",
    protected: false,
    system: false,
    permissions: ["licenses.read"],
    ...overrides,
  };
}

function directoryUser(overrides: Partial<DirectoryUser> = {}): DirectoryUser {
  return {
    userId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    email: "casey@cml.example",
    actorKind: "staff",
    roleId: "33333333-3333-4333-8333-333333333333",
    roleKey: "cml_viewer",
    organizationId: null,
    protectedAdmin: false,
    disabled: false,
    ...overrides,
  };
}

const superAdmin = principal();
const operator = principal({
  userId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  email: "op@cml.example",
  permissions: OPERATOR_PERMISSIONS,
  roleId: "22222222-2222-4222-8222-222222222222",
});
const viewer = principal({
  permissions: VIEWER_PERMISSIONS,
  roleId: "33333333-3333-4333-8333-333333333333",
  aal: "aal2",
});
const harborAdmin = principal({
  userId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  email: "elena@harbor.example",
  actorKind: "tenant",
  permissions: PHARMACY_ADMIN_PERMISSIONS,
  organizationIds: [HARBOR],
  aal: "aal1",
  roleId: "44444444-4444-4444-8444-444444444444",
});
const harborViewer = principal({
  userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  email: "guest@harbor.example",
  actorKind: "tenant",
  permissions: PHARMACY_VIEWER_PERMISSIONS,
  organizationIds: [HARBOR],
  aal: "aal1",
  roleId: "55555555-5555-4555-8555-555555555555",
});

describe("tenant boundaries", () => {
  it("lets a pharmacy user read only their organization", () => {
    assert.equal(canReadOrganization(harborViewer, HARBOR), true);
    assert.equal(canReadOrganization(harborViewer, MESA), false);
    assert.equal(canWriteLicense(harborViewer), false);
    assert.equal(canImportRoster(harborViewer), false);
  });

  it("lets a pharmacy admin manage people only inside their pharmacy", () => {
    const harborUser = directoryUser({
      actorKind: "tenant",
      organizationId: HARBOR,
      email: "tech@harbor.example",
      roleKey: "pharmacy_viewer",
    });
    const mesaUser = directoryUser({
      actorKind: "tenant",
      organizationId: MESA,
      email: "tech@mesa.example",
    });
    const viewerRole = role({
      scope: "tenant",
      key: "pharmacy_viewer",
      permissions: PHARMACY_VIEWER_PERMISSIONS,
    });
    assert.equal(evaluateAssignRole(harborAdmin, harborUser, viewerRole).ok, true);
    assert.equal(evaluateAssignRole(harborAdmin, mesaUser, viewerRole).ok, false);
    assert.equal(evaluateCreateUser(harborAdmin, {
      email: "new@harbor.example",
      displayName: "New Harbor",
      password: "HarborPass12",
      actorKind: "tenant",
      role: viewerRole,
      organizationId: HARBOR,
    }).ok, true);
    assert.equal(evaluateCreateUser(harborAdmin, {
      email: "new@mesa.example",
      displayName: "New Mesa",
      password: "HarborPass12",
      actorKind: "tenant",
      role: viewerRole,
      organizationId: MESA,
    }).ok, false);
  });

  it("refuses a pharmacy user who tries to create CML staff", () => {
    const decision = evaluateCreateUser(harborAdmin, {
      email: "new@cml.example",
      displayName: "New Staff",
      password: "HarborPass12",
      actorKind: "staff",
      role: role({ permissions: ["licenses.read"] }),
      organizationId: null,
    });
    assert.equal(decision.ok, false);
  });
});

describe("staff permissions", () => {
  it("lets an operator change the book and blocks a viewer", () => {
    assert.equal(canReadOrganization(operator, MESA), true);
    assert.equal(canWriteLicense(operator), true);
    assert.equal(canImportRoster(operator), true);
    assert.equal(canReadOrganization(viewer, MESA), true);
    assert.equal(canWriteLicense(viewer), false);
    assert.equal(canImportRoster(viewer), false);
  });

  it("stops a viewer from creating users or editing roles", () => {
    const decision = evaluateCreateUser(viewer, {
      email: "new@cml.example",
      displayName: "New",
      password: "ViewerPass12",
      actorKind: "staff",
      role: role({ permissions: ["licenses.read"] }),
      organizationId: null,
    });
    assert.equal(decision.ok, false);
    assert.equal(evaluateRoleEdit(viewer, role(), {
      name: "Custom",
      description: "",
      permissions: ["licenses.read"],
    }).ok, false);
    assert.equal(evaluateRoleDelete(viewer, role()).ok, false);
    assert.equal(evaluateRoleDelete(superAdmin, role({ system: true })).ok, false);
    assert.equal(evaluateRoleDelete(superAdmin, role()).ok, true);
  });

  it("stops privilege escalation when assigning a stronger staff role", () => {
    const limited = principal({
      permissions: ["users.manage", "users.read", "roles.read"],
      roleId: "99999999-9999-4999-8999-999999999999",
    });
    const decision = evaluateAssignRole(
      limited,
      directoryUser(),
      role({ key: "cml_operator", permissions: OPERATOR_PERMISSIONS, system: true }),
    );
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.match(decision.message, /do not hold/);
    }
  });
});

describe("protected super admin", () => {
  const protectedUser = directoryUser({
    userId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    email: PROTECTED_ADMIN_EMAIL,
    roleKey: "super_admin",
    roleId: SUPER_ADMIN_ROLE_ID,
    protectedAdmin: true,
  });

  it("cannot be demoted, disabled, or deleted", () => {
    const assign = evaluateAssignRole(superAdmin, protectedUser, role({ key: "cml_viewer", permissions: VIEWER_PERMISSIONS }));
    const disable = evaluateSetDisabled(superAdmin, protectedUser, true);
    const remove = evaluateDeleteUser(superAdmin, protectedUser);
    assert.equal(assign.ok, false);
    assert.equal(disable.ok, false);
    assert.equal(remove.ok, false);
    if (!assign.ok) assert.match(assign.message, /cannot be demoted/);
    if (!disable.ok) assert.match(disable.message, /cannot be disabled/);
    if (!remove.ok) assert.match(remove.message, /cannot be deleted/);
  });

  it("is not created through the public admin form", () => {
    const decision = evaluateCreateUser(superAdmin, {
      email: PROTECTED_ADMIN_EMAIL,
      displayName: "CML Super Admin",
      password: "SuperPass1234",
      actorKind: "staff",
      role: role({ id: SUPER_ADMIN_ROLE_ID, key: "super_admin", protected: true, system: true, permissions: STAFF_PERMISSIONS }),
      organizationId: null,
    });
    assert.equal(decision.ok, false);
  });

  it("keeps at least one protected super admin when one would be removed", () => {
    const users = [
      { userId: protectedUser.userId, protectedAdmin: true, roleKey: "super_admin" },
    ];
    assert.equal(protectedAdminsRemaining(users, protectedUser.userId), 0);
    assert.equal(protectedAdminsRemaining(users, "someone-else"), 1);
  });

  it("leaves the super admin role immutable", () => {
    const decision = evaluateRoleEdit(
      superAdmin,
      role({
        id: SUPER_ADMIN_ROLE_ID,
        key: "super_admin",
        protected: true,
        system: true,
        permissions: STAFF_PERMISSIONS,
      }),
      { name: "Renamed", description: "", permissions: ["licenses.read"] },
    );
    assert.equal(decision.ok, false);
  });
});

describe("admin MFA", () => {
  it("requires aal2 for staff and allows aal1 for pharmacy users", () => {
    const staffPasswordOnly = principal({ aal: "aal1" });
    assert.equal(sessionSatisfiesMfa(staffPasswordOnly), false);
    assert.equal(canReadOrganization(staffPasswordOnly, HARBOR), false);
    assert.equal(sessionSatisfiesMfa(harborViewer), true);
    assert.equal(canReadOrganization(harborViewer, HARBOR), true);
    const decision = evaluateDeleteUser(staffPasswordOnly, directoryUser());
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.match(decision.message, /authenticator/);
  });
});

describe("audit metadata", () => {
  it("refuses secrets", () => {
    assert.equal(assertAuditMetadata({ email: "ada@cml.example" }).ok, true);
    assert.equal(assertAuditMetadata({ password: "nope" }).ok, false);
    assert.equal(assertAuditMetadata({ access_token: "nope" }).ok, false);
  });
});
