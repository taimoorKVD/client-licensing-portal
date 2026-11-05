import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  OPERATOR_PERMISSIONS,
  PERMISSIONS,
  PHARMACY_ADMIN_PERMISSIONS,
  PHARMACY_VIEWER_PERMISSIONS,
  PROTECTED_ADMIN_EMAIL,
  VIEWER_PERMISSIONS,
} from "@/lib/auth/catalog";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const migrationPath = path.join(
  root,
  "supabase/migrations/20261105195658_auth_access_control.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");

function permissionList(role: string): string[] {
  const marker = `-- role:${role}`;
  const start = sql.indexOf(marker);
  assert.notEqual(start, -1, `missing ${marker}`);
  const slice = sql.slice(start, sql.indexOf(";", start));
  return [...slice.matchAll(/'([a-z0-9.]+)'/g)].map((match) => match[1]);
}

describe("auth migration contract", () => {
  it("defines every catalog permission and the system role bundles", () => {
    for (const permission of PERMISSIONS) {
      assert.equal(sql.includes(`'${permission.key}'`), true, permission.key);
    }
    assert.deepEqual(permissionList("cml_operator"), [...OPERATOR_PERMISSIONS]);
    assert.deepEqual(permissionList("cml_viewer"), [...VIEWER_PERMISSIONS]);
    assert.deepEqual(permissionList("pharmacy_admin"), [...PHARMACY_ADMIN_PERMISSIONS]);
    assert.deepEqual(permissionList("pharmacy_viewer"), [...PHARMACY_VIEWER_PERMISSIONS]);
    assert.match(sql, /role:super_admin[\s\S]*where permission\.scope = 'staff'/);
  });

  it("enables and forces RLS, and keeps helpers in the private schema", () => {
    for (const table of [
      "permissions",
      "roles",
      "role_permissions",
      "profiles",
      "staff_assignments",
      "audit_events",
    ]) {
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
      assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`));
    }
    assert.match(sql, /create or replace function private\.has_staff_permission/);
    assert.match(sql, /create or replace function private\.has_tenant_permission/);
    assert.match(sql, /security definer/);
    assert.match(sql, /set search_path = ''/);
    assert.equal(sql.includes("security definer") && sql.includes("create or replace function public.record_admin_event"), true);
    assert.match(sql, /function public\.record_admin_event[\s\S]*security invoker/);
  });

  it("requires staff MFA from the JWT aal claim and reserves the protected admin", () => {
    assert.match(sql, /auth\.jwt\(\) ->> 'aal'/);
    assert.match(sql, /'aal2'/);
    assert.equal(sql.includes(PROTECTED_ADMIN_EMAIL), true);
    assert.match(sql, /The protected super admin cannot be demoted/);
    assert.match(sql, /The protected super admin cannot be deleted/);
    assert.match(sql, /private\.bootstrap_protected_admin/);
    assert.match(sql, /revoke all on function private\.bootstrap_protected_admin\(\) from public, anon, authenticated, service_role/);
    assert.match(sql, /This function does not create the user or set a password/);
  });

  it("does not authorize from user-editable metadata", () => {
    const code = sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    assert.equal(code.includes("user_metadata"), false);
    assert.equal(code.includes("raw_user_meta_data"), false);
    assert.equal(code.includes("app_metadata"), false);
  });
});
