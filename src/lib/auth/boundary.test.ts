import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { ALL_PERMISSIONS, PROTECTED_SUPER_ADMIN_EMAIL } from "./access";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function walk(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") return [];
      return walk(full);
    }
    return full;
  });
}

function sourceFiles(): string[] {
  return walk(path.join(root, "src")).filter(
    (file) => /\.(ts|tsx)$/.test(file) && !file.endsWith(".test.ts"),
  );
}

describe("auth boundaries in source", () => {
  it("keeps the service role off the browser and does not authorize from user metadata", () => {
    const files = sourceFiles();
    const offenders: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      const isClient = text.includes('"use client"') || text.includes("'use client'");
      if (isClient && /@\/lib\/auth\/admin["']/.test(text)) offenders.push(file);
      assert.equal(/\.signUp\s*\(/.test(text), false, `${file} exposes signup`);
      assert.equal(/user_metadata\s*:/.test(text), false, `${file} writes user_metadata`);
      assert.equal(/app_metadata\s*:/.test(text), false, `${file} writes app_metadata`);
      assert.equal(text.includes("NEXT_PUBLIC_SUPABASE_SECRET"), false, file);
    }
    assert.deepEqual(offenders, []);

    const admin = fs.readFileSync(path.join(root, "src/lib/auth/admin.ts"), "utf8");
    assert.match(admin, /server-only/);
    assert.match(admin, /SUPABASE_SECRET_KEY/);
    assert.match(admin, /cannot run in the browser/);
  });

  it("locks the migration to the reserved super admin, RLS, and the permission catalog", () => {
    const sql = fs.readFileSync(
      path.join(root, "supabase/migrations/20261105195500_access_control.sql"),
      "utf8",
    );
    const config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");
    const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");

    assert.match(sql, new RegExp(PROTECTED_SUPER_ADMIN_EMAIL.replace(".", "\\.")));
    assert.match(sql, /private\.bootstrap_super_admin/);
    assert.match(sql, /The protected super admin cannot be deleted/);
    assert.match(sql, /The protected super admin cannot be demoted/);
    const executable = sql.replace(/--.*$/gm, "");
    assert.match(sql, /enable row level security/);
    assert.match(sql, /security definer/);
    assert.match(sql, /set search_path = ''/);
    assert.doesNotMatch(executable, /user_metadata/);
    assert.doesNotMatch(executable, /raw_user_meta_data/);
    assert.doesNotMatch(executable, /app_metadata/);
    for (const permission of ALL_PERMISSIONS) {
      assert.equal(sql.includes(`'${permission}'`), true, permission);
    }

    assert.match(config, /enable_signup = false/);
    assert.match(config, /enroll_enabled = true/);
    assert.match(config, /verify_enabled = true/);
    const configCode = nextConfig.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(configCode, /output\s*:/);
  });
});
