import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PROTECTED_SUPER_ADMIN_EMAIL,
  STAFF_PERMISSIONS,
  TENANT_PERMISSIONS,
  assertPermissionList,
  canImportRoster,
  canReadOrganization,
  canWriteLicenses,
  guardCreateUserEmail,
  guardProtectedStaff,
  guardRoleEdit,
  hasPermission,
  mfaGate,
  rowsVisibleTo,
  type PortalActor,
} from "./access";

const HARBOR = "2c8df56d-3a03-4ca0-adba-93c480874bdb";
const MESA = "248557d9-29e0-4ef0-a42a-42c87976dc99";

const licenses = [
  { id: "lic-harbor", organizationId: HARBOR, licenseNumber: "PH-WA-104482" },
  { id: "lic-mesa", organizationId: MESA, licenseNumber: "Y-22841" },
];

function actor(partial: Partial<PortalActor> & Pick<PortalActor, "kind" | "permissions">): PortalActor {
  return {
    userId: "user-1",
    email: "person@example.com",
    displayName: "Person",
    roleSlug: partial.kind === "staff" ? "cml_operator" : "pharmacy_viewer",
    roleName: partial.kind === "staff" ? "CML operator" : "Pharmacy viewer",
    organizationIds: [],
    organizationName: null,
    protected: false,
    ...partial,
  };
}

describe("tenant boundaries", () => {
  it("keeps a pharmacy user inside their own organization", () => {
    const harbor = actor({
      kind: "tenant",
      organizationIds: [HARBOR],
      permissions: [...TENANT_PERMISSIONS],
    });

    assert.equal(canReadOrganization(harbor, HARBOR), true);
    assert.equal(canReadOrganization(harbor, MESA), false);
    assert.deepEqual(
      rowsVisibleTo(harbor, licenses, "tenant.licenses.read").map((row) => row.id),
      ["lic-harbor"],
    );
    assert.deepEqual(rowsVisibleTo(harbor, licenses, "staff.licenses.read"), []);
    assert.equal(canWriteLicenses(harbor), false);
    assert.equal(canImportRoster(harbor), false);
  });

  it("does not let a pharmacy user borrow another tenant's rows by holding the read permission", () => {
    const harbor = actor({
      kind: "tenant",
      organizationIds: [HARBOR],
      permissions: ["tenant.licenses.read"],
    });
    const visible = rowsVisibleTo(harbor, licenses, "tenant.licenses.read");
    assert.equal(visible.some((row) => row.organizationId === MESA), false);
  });

  it("lets CML staff with book access see every pharmacy, and hides the book when that permission is missing", () => {
    const operator = actor({
      kind: "staff",
      permissions: ["staff.licenses.read", "staff.organizations.read"],
    });
    const auditor = actor({
      kind: "staff",
      permissions: ["staff.audit.read"],
    });

    assert.equal(canReadOrganization(operator, MESA), true);
    assert.equal(rowsVisibleTo(operator, licenses, "staff.licenses.read").length, 2);
    assert.deepEqual(rowsVisibleTo(auditor, licenses, "staff.licenses.read"), []);
    assert.equal(canReadOrganization(auditor, HARBOR), false);
  });

  it("rejects a staff permission on a tenant role and a tenant permission on a staff role", () => {
    assert.equal(assertPermissionList("tenant", ["staff.users.manage"]).ok, false);
    assert.equal(assertPermissionList("staff", ["tenant.licenses.read"]).ok, false);
    assert.equal(assertPermissionList("tenant", []).ok, false);
    assert.equal(assertPermissionList("tenant", [...TENANT_PERMISSIONS]).ok, true);
  });
});

describe("protected super admin", () => {
  it("blocks demotion, deletion, disablement, and email changes for the reserved account", () => {
    for (const action of ["delete", "demote", "disable", "change_role", "change_email"] as const) {
      const byFlag = guardProtectedStaff({
        email: "someone-else@example.com",
        protected: true,
        action,
      });
      const byEmail = guardProtectedStaff({
        email: PROTECTED_SUPER_ADMIN_EMAIL.toUpperCase(),
        protected: false,
        action,
      });
      assert.equal(byFlag.ok, false);
      assert.equal(byEmail.ok, false);
    }
  });

  it("allows the same actions for an ordinary staff account", () => {
    assert.deepEqual(
      guardProtectedStaff({
        email: "ops@example.com",
        protected: false,
        action: "delete",
      }),
      { ok: true },
    );
  });

  it("refuses to create the reserved super admin through the app", () => {
    const reserved = guardCreateUserEmail(`  ${PROTECTED_SUPER_ADMIN_EMAIL} `);
    assert.equal(reserved.ok, false);
    assert.equal(guardCreateUserEmail("ops@example.com").ok, true);
  });

  it("locks the super admin role and still lets a custom role change its permissions", () => {
    const locked = guardRoleEdit(
      { slug: "super_admin", scope: "staff", system: true, protected: true },
      { permissions: ["staff.audit.read"] },
    );
    assert.equal(locked.ok, false);

    const deleted = guardRoleEdit(
      { slug: "super_admin", scope: "staff", system: true, protected: true },
      { delete: true },
    );
    assert.equal(deleted.ok, false);

    const custom = guardRoleEdit(
      { slug: "renewals", scope: "staff", system: false, protected: false },
      { permissions: ["staff.licenses.read", "staff.licenses.write"] },
    );
    assert.equal(custom.ok, true);

    const systemDelete = guardRoleEdit(
      { slug: "cml_operator", scope: "staff", system: true, protected: false },
      { delete: true },
    );
    assert.equal(systemDelete.ok, false);
  });
});

describe("admin MFA gate", () => {
  it("sends a staff member with no factor to enrollment on first sign-in", () => {
    assert.equal(
      mfaGate({ kind: "staff", verifiedFactorCount: 0, currentLevel: "aal1" }),
      "enroll",
    );
  });

  it("challenges a staff member who already enrolled and lets aal2 through", () => {
    assert.equal(
      mfaGate({ kind: "staff", verifiedFactorCount: 1, currentLevel: "aal1" }),
      "challenge",
    );
    assert.equal(
      mfaGate({ kind: "staff", verifiedFactorCount: 1, currentLevel: "aal2" }),
      "ready",
    );
  });

  it("leaves pharmacy users alone until they opt into a factor", () => {
    assert.equal(
      mfaGate({ kind: "tenant", verifiedFactorCount: 0, currentLevel: "aal1" }),
      "ready",
    );
    assert.equal(
      mfaGate({ kind: "tenant", verifiedFactorCount: 1, currentLevel: "aal1" }),
      "challenge",
    );
  });

  it("does not treat a staff read permission as a license edit", () => {
    const reader = actor({ kind: "staff", permissions: [...STAFF_PERMISSIONS].filter((item) => item !== "staff.licenses.write") });
    assert.equal(hasPermission(reader, "staff.licenses.read"), true);
    assert.equal(canWriteLicenses(reader), false);
    assert.equal(canImportRoster(reader), true);
  });
});
