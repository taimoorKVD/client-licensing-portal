import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUserSchema, passwordSchema } from "./schemas";

const roleId = "11111111-1111-4111-8111-111111111111";
const organizationId = "22222222-2222-4222-8222-222222222222";

describe("account schemas", () => {
  it("rejects a short password and accepts a mixed one", () => {
    assert.equal(passwordSchema.safeParse("short").success, false);
    assert.equal(passwordSchema.safeParse("alllowercase12").success, false);
    assert.equal(passwordSchema.safeParse("HarborPine12").success, true);
  });

  it("keeps CML staff off a pharmacy membership and requires one for a pharmacy user", () => {
    const staff = createUserSchema.safeParse({
      email: "ops@example.com",
      displayName: "Ops",
      password: "HarborPine12",
      actorKind: "staff",
      roleId,
      organizationId,
    });
    const tenant = createUserSchema.safeParse({
      email: "pharmacy@example.com",
      displayName: "Counter",
      password: "HarborPine12",
      actorKind: "tenant",
      roleId,
    });
    assert.equal(staff.success, false);
    assert.equal(tenant.success, false);
  });
});
