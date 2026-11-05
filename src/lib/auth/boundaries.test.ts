import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function sourceFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (entry.name.endsWith(".test.ts")) return [];
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) return [full];
    return [];
  });
}

describe("auth boundaries", () => {
  it("does not offer public signup or authorize from user metadata", () => {
    const files = sourceFiles(path.join(root, "src"));
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      assert.equal(text.includes(".signUp("), false, file);
      const executable = text
        .split("\n")
        .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//") && !line.trim().startsWith("/*"));
      const joined = executable.join("\n");
      assert.equal(joined.includes("user_metadata"), false, file);
      assert.equal(joined.includes("raw_user_meta_data"), false, file);
      assert.equal(joined.includes("app_metadata"), false, file);
    }
  });

  it("keeps the service role out of browser modules", () => {
    const env = fs.readFileSync(path.join(root, "src/lib/env.ts"), "utf8");
    const admin = fs.readFileSync(path.join(root, "src/lib/supabase/admin.ts"), "utf8");
    const service = fs.readFileSync(path.join(root, "src/lib/auth/admin-service.ts"), "utf8");
    assert.equal(env.includes("SUPABASE_SECRET_KEY"), false);
    assert.match(admin, /import "server-only"/);
    assert.match(service, /import "server-only"/);
    assert.doesNotMatch(service, /event_metadata:\s*\{[^}]*password/);
    assert.equal(service.includes("user_metadata"), false);
    assert.equal(service.includes("app_metadata"), false);
  });
});
