import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { mfaPath } from "./auth/access";
import {
  APP_HOME,
  LOGIN_PATH,
  MFA_CHALLENGE_PATH,
  MFA_ENROLL_PATH,
  appPath,
  isAppPath,
  isPublicPath,
  legacyLoginPath,
} from "./paths";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("public site and app paths", () => {
  it("keeps the marketing homepage public and the book behind the app prefix", () => {
    assert.equal(isPublicPath("/"), true);
    assert.equal(isPublicPath("/app"), false);
    assert.equal(isPublicPath("/app/licenses"), false);
    assert.equal(isPublicPath("/app/licenses/abc"), false);
    assert.equal(isPublicPath("/app/admin/users"), false);
    assert.equal(isPublicPath("/app/import"), false);
    assert.equal(isPublicPath(LOGIN_PATH), true);
    assert.equal(isPublicPath(MFA_ENROLL_PATH), true);
    assert.equal(isPublicPath(MFA_CHALLENGE_PATH), true);
    assert.equal(isPublicPath("/app/login/end"), true);
    assert.equal(isPublicPath("/login"), true);
    assert.equal(isPublicPath("/login/mfa/enroll"), true);
    assert.equal(isPublicPath("/app/login-help"), false);
    assert.equal(isAppPath("/"), false);
    assert.equal(isAppPath("/login"), false);
    assert.equal(isAppPath("/app"), true);
    assert.equal(isAppPath("/app/licenses"), true);
    assert.equal(isAppPath("/app/login"), true);
    assert.equal(isAppPath("/application"), false);
  });

  it("maps old sign-in bookmarks onto the app prefix and preserves the rest of the path", () => {
    assert.equal(legacyLoginPath("/login"), LOGIN_PATH);
    assert.equal(legacyLoginPath("/login/mfa/enroll"), MFA_ENROLL_PATH);
    assert.equal(legacyLoginPath("/login/mfa/challenge"), MFA_CHALLENGE_PATH);
    assert.equal(legacyLoginPath("/login/end"), "/app/login/end");
    assert.equal(legacyLoginPath("/"), null);
    assert.equal(legacyLoginPath("/app"), null);
    assert.equal(legacyLoginPath(LOGIN_PATH), null);
  });

  it("prefixes application hrefs", () => {
    assert.equal(appPath("/"), APP_HOME);
    assert.equal(appPath(""), APP_HOME);
    assert.equal(appPath("/licenses"), "/app/licenses");
    assert.equal(appPath(`/licenses/${"abc"}`), "/app/licenses/abc");
    assert.equal(appPath("/licenses?status=expiring"), "/app/licenses?status=expiring");
    assert.equal(appPath("/admin/users"), "/app/admin/users");
  });

  it("sends a finished sign-in to /app and MFA steps under /app/login", () => {
    assert.equal(mfaPath("enroll"), MFA_ENROLL_PATH);
    assert.equal(mfaPath("challenge"), MFA_CHALLENGE_PATH);
    assert.equal(mfaPath("ready"), APP_HOME);
  });

  it("ships the approved marketing page at the site root", () => {
    const page = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
    const home = fs.readFileSync(path.join(root, "src/components/marketing/home.tsx"), "utf8");
    assert.match(page, /Client License Portal/);
    assert.match(home, /Every pharmacy license, kept in one calm book/);
    assert.match(home, /CML Licensing/);
    assert.match(home, /Request access/);
    assert.match(home, /https:\/\/taimoorhussain\.com\/contact/);
    assert.match(home, /clp-login\.png/);
    assert.doesNotMatch(home, /signUp\s*\(/);
    assert.doesNotMatch(home, /hello@taimoorhussain\.com/);
    assert.doesNotMatch(home, /Kingdom Vision|RoomBoss|Bolo/);
  });
});
