import "server-only";

import { revalidatePath } from "next/cache";
import { createAdminClient, revokeUserSessions } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActorKind } from "@/lib/auth/catalog";
import { loadRoles, type RoleRecord } from "@/lib/auth/directory";
import {
  assertAuditMetadata,
  evaluateAssignRole,
  evaluateCreateUser,
  evaluateDeleteUser,
  evaluateRoleDelete,
  evaluateRoleEdit,
  evaluateSetDisabled,
  normalizeEmail,
  type DirectoryUser,
} from "@/lib/auth/policy";
import { readSession, toPrincipal } from "@/lib/auth/session";
import type { ServiceResult } from "@/lib/auth/types";

function fail(status: number, message: string): ServiceResult<never> {
  return { ok: false, status, message };
}

function friendlyDatabaseError(message: string): string {
  const text = message.replace(/^P0001:\s*/, "");
  if (
    /protected super admin|cannot |pharmacy|Staff and pharmacy|System roles|permission|reserved/i.test(
      text,
    )
  ) {
    return text;
  }
  if (/duplicate key|already registered|already been registered/i.test(text)) {
    return "That email is already in the directory.";
  }
  if (/foreign key|still referenced/i.test(text)) {
    return "That role is still assigned to someone.";
  }
  return "The directory rejected that change.";
}

async function actor() {
  const session = await readSession();
  if (!session) return fail(401, "Sign in required.");
  if (!session.provisioned || session.disabled) return fail(403, "This account cannot administer the directory.");
  if (session.actorKind === "staff" && session.aal !== "aal2") {
    return fail(403, "Staff accounts must finish authenticator verification first.");
  }
  return { ok: true as const, data: toPrincipal(session) };
}

async function roleById(roleId: string): Promise<RoleRecord | null> {
  const roles = await loadRoles();
  return roles.find((role) => role.id === roleId) ?? null;
}

async function directoryUser(userId: string): Promise<DirectoryUser | null> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id, email, actor_kind, disabled_at")
    .eq("user_id", userId)
    .maybeSingle<{
      user_id: string;
      email: string;
      actor_kind: ActorKind;
      disabled_at: string | null;
    }>();
  if (!profile) return null;

  if (profile.actor_kind === "staff") {
    const { data: assignment } = await supabase
      .from("staff_assignments")
      .select("role_id, protected, roles(key)")
      .eq("user_id", userId)
      .maybeSingle<{
        role_id: string;
        protected: boolean;
        roles: { key: string } | { key: string }[] | null;
      }>();
    const role = assignment?.roles;
    const roleKey = Array.isArray(role) ? role[0]?.key : role?.key;
    return {
      userId: profile.user_id,
      email: profile.email,
      actorKind: "staff",
      roleId: assignment?.role_id ?? "",
      roleKey: roleKey ?? "",
      organizationId: null,
      protectedAdmin: assignment?.protected ?? false,
      disabled: profile.disabled_at !== null,
    };
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role_id, roles(key)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle<{
      organization_id: string;
      role_id: string;
      roles: { key: string } | { key: string }[] | null;
    }>();
  const role = membership?.roles;
  const roleKey = Array.isArray(role) ? role[0]?.key : role?.key;
  return {
    userId: profile.user_id,
    email: profile.email,
    actorKind: "tenant",
    roleId: membership?.role_id ?? "",
    roleKey: roleKey ?? "",
    organizationId: membership?.organization_id ?? null,
    protectedAdmin: false,
    disabled: profile.disabled_at !== null,
  };
}

async function audit(
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  metadata: Record<string, unknown>,
  organizationId: string | null,
) {
  const safe = assertAuditMetadata(metadata);
  if (!safe.ok) throw new Error(safe.message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_admin_event", {
    event_action: action,
    event_entity_type: entityType,
    event_entity_id: entityId,
    event_organization_id: organizationId,
    event_summary: summary,
    event_metadata: metadata,
  });
  if (error) throw new Error(friendlyDatabaseError(error.message));
}

function refresh() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/users");
  revalidatePath("/admin/roles");
  revalidatePath("/admin/audit");
}

export async function createPortalUser(input: {
  email: string;
  displayName: string;
  password: string;
  actorKind: ActorKind;
  roleId: string;
  organizationId: string | null;
}): Promise<ServiceResult<{ userId: string }>> {
  const current = await actor();
  if (!current.ok) return current;
  const role = await roleById(input.roleId);
  if (!role) return fail(400, "Choose a role.");
  const decision = evaluateCreateUser(current.data, {
    email: input.email,
    displayName: input.displayName,
    password: input.password,
    actorKind: input.actorKind,
    role,
    organizationId: input.organizationId,
  });
  if (!decision.ok) return fail(403, decision.message);

  const email = normalizeEmail(input.email);
  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    return fail(400, friendlyDatabaseError(created.error?.message ?? "The account was not created."));
  }

  const userId = created.data.user.id;
  const supabase = await createClient();
  const profile = await supabase.from("profiles").insert({
    user_id: userId,
    email,
    display_name: input.displayName.trim(),
    actor_kind: input.actorKind,
  });
  if (profile.error) {
    await admin.auth.admin.deleteUser(userId);
    return fail(400, friendlyDatabaseError(profile.error.message));
  }

  const link =
    input.actorKind === "staff"
      ? await supabase.from("staff_assignments").insert({
          user_id: userId,
          role_id: role.id,
          protected: false,
        })
      : await supabase.from("memberships").insert({
          user_id: userId,
          organization_id: input.organizationId,
          role_id: role.id,
        });
  if (link.error) {
    await supabase.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    return fail(400, friendlyDatabaseError(link.error.message));
  }

  await audit(
    "auth.user_created",
    "auth.users",
    userId,
    `Created ${input.actorKind} account ${email}`,
    { email, actor_kind: input.actorKind, role_key: role.key },
    input.organizationId,
  );
  refresh();
  return { ok: true, data: { userId } };
}

export async function assignPortalRole(
  userId: string,
  roleId: string,
): Promise<ServiceResult<{ userId: string }>> {
  const current = await actor();
  if (!current.ok) return current;
  const target = await directoryUser(userId);
  const role = await roleById(roleId);
  if (!target || !role) return fail(404, "That person or role is not in your directory.");
  const decision = evaluateAssignRole(current.data, target, role);
  if (!decision.ok) return fail(403, decision.message);

  const supabase = await createClient();
  if (target.actorKind === "tenant" && !target.organizationId) {
    return fail(400, "That pharmacy user is not tied to a pharmacy.");
  }
  const update =
    target.actorKind === "staff"
      ? await supabase
          .from("staff_assignments")
          .update({ role_id: role.id })
          .eq("user_id", userId)
          .select("user_id")
      : await supabase
          .from("memberships")
          .update({ role_id: role.id })
          .eq("user_id", userId)
          .eq("organization_id", target.organizationId)
          .select("user_id");
  if (update.error) return fail(400, friendlyDatabaseError(update.error.message));
  if (!update.data?.length) return fail(403, "The directory rejected that change.");
  await audit(
    "auth.role_assigned",
    "profiles",
    userId,
    `Assigned ${role.key} to ${target.email}`,
    { role_key: role.key },
    target.organizationId,
  );
  refresh();
  return { ok: true, data: { userId } };
}

export async function setPortalUserDisabled(
  userId: string,
  disabled: boolean,
): Promise<ServiceResult<{ userId: string }>> {
  const current = await actor();
  if (!current.ok) return current;
  const target = await directoryUser(userId);
  if (!target) return fail(404, "That person is not in your directory.");
  const decision = evaluateSetDisabled(current.data, target, disabled);
  if (!decision.ok) return fail(403, decision.message);

  const supabase = await createClient();
  const update = await supabase
    .from("profiles")
    .update({ disabled_at: disabled ? new Date().toISOString() : null })
    .eq("user_id", userId)
    .select("user_id");
  if (update.error) return fail(400, friendlyDatabaseError(update.error.message));
  if (!update.data?.length) return fail(403, "The directory rejected that change.");

  const admin = createAdminClient();
  const banned = await admin.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? "876000h" : "none",
  });
  if (banned.error) return fail(400, friendlyDatabaseError(banned.error.message));
  if (disabled) await revokeUserSessions(userId);
  await audit(
    disabled ? "auth.user_disabled" : "auth.user_enabled",
    "profiles",
    userId,
    `${disabled ? "Disabled" : "Enabled"} ${target.email}`,
    { email: target.email },
    target.organizationId,
  );
  refresh();
  return { ok: true, data: { userId } };
}

export async function deletePortalUser(userId: string): Promise<ServiceResult<{ userId: string }>> {
  const current = await actor();
  if (!current.ok) return current;
  const target = await directoryUser(userId);
  if (!target) return fail(404, "That person is not in your directory.");
  const decision = evaluateDeleteUser(current.data, target);
  if (!decision.ok) return fail(403, decision.message);

  await revokeUserSessions(userId);
  const supabase = await createClient();
  const removed = await supabase.from("profiles").delete().eq("user_id", userId).select("user_id");
  if (removed.error) return fail(400, friendlyDatabaseError(removed.error.message));
  if (!removed.data?.length) return fail(403, "The directory rejected that change.");
  const admin = createAdminClient();
  const deleted = await admin.auth.admin.deleteUser(userId);
  if (deleted.error) return fail(400, friendlyDatabaseError(deleted.error.message));
  await audit(
    "auth.user_deleted",
    "profiles",
    userId,
    `Deleted ${target.email}`,
    { email: target.email, actor_kind: target.actorKind },
    target.organizationId,
  );
  refresh();
  return { ok: true, data: { userId } };
}

export async function savePortalRole(input: {
  roleId?: string;
  name: string;
  description: string;
  scope: ActorKind;
  permissions: string[];
}): Promise<ServiceResult<{ roleId: string }>> {
  const current = await actor();
  if (!current.ok) return current;
  const permissions = [...new Set(input.permissions)];

  if (!input.roleId) {
    const decision = evaluateRoleEdit(
      current.data,
      {
        id: "new",
        key: "new",
        scope: input.scope,
        protected: false,
        system: false,
        permissions: [],
      },
      { name: input.name, description: input.description, permissions },
    );
    if (!decision.ok) return fail(403, decision.message);
    const roleId = crypto.randomUUID();
    const key = customRoleKey(input.name);
    const supabase = await createClient();
    const created = await supabase.from("roles").insert({
      id: roleId,
      scope: input.scope,
      key,
      name: input.name.trim(),
      description: input.description.trim(),
      system: false,
      protected: false,
    });
    if (created.error) return fail(400, friendlyDatabaseError(created.error.message));
    const granted = await supabase.from("role_permissions").insert(
      permissions.map((permission) => ({ role_id: roleId, permission_key: permission })),
    );
    if (granted.error) {
      await supabase.from("roles").delete().eq("id", roleId);
      return fail(400, friendlyDatabaseError(granted.error.message));
    }
    await audit("roles.created", "roles", roleId, `Created role ${input.name.trim()}`, { key, scope: input.scope }, null);
    refresh();
    return { ok: true, data: { roleId } };
  }

  const role = await roleById(input.roleId);
  if (!role) return fail(404, "That role is not in the directory.");
  const decision = evaluateRoleEdit(current.data, role, {
    name: input.name,
    description: input.description,
    permissions,
  });
  if (!decision.ok) return fail(403, decision.message);

  const supabase = await createClient();
  const renamed = await supabase
    .from("roles")
    .update({ name: input.name.trim(), description: input.description.trim() })
    .eq("id", role.id);
  if (renamed.error) return fail(400, friendlyDatabaseError(renamed.error.message));

  const next = new Set(permissions);
  const remove = role.permissions.filter((permission) => !next.has(permission));
  const add = permissions.filter((permission) => !role.permissions.includes(permission));
  if (add.length > 0) {
    const inserted = await supabase.from("role_permissions").insert(
      add.map((permission) => ({ role_id: role.id, permission_key: permission })),
    );
    if (inserted.error) return fail(400, friendlyDatabaseError(inserted.error.message));
  }
  if (remove.length > 0) {
    const deleted = await supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", role.id)
      .in("permission_key", remove);
    if (deleted.error) return fail(400, friendlyDatabaseError(deleted.error.message));
  }
  await audit("roles.updated", "roles", role.id, `Updated role ${input.name.trim()}`, { key: role.key }, null);
  refresh();
  return { ok: true, data: { roleId: role.id } };
}

export async function deletePortalRole(roleId: string): Promise<ServiceResult<{ roleId: string }>> {
  const current = await actor();
  if (!current.ok) return current;
  const role = await roleById(roleId);
  if (!role) return fail(404, "That role is not in the directory.");
  const decision = evaluateRoleDelete(current.data, role);
  if (!decision.ok) return fail(403, decision.message);
  const supabase = await createClient();
  const removed = await supabase.from("roles").delete().eq("id", roleId);
  if (removed.error) return fail(400, friendlyDatabaseError(removed.error.message));
  await audit("roles.deleted", "roles", roleId, `Deleted role ${role.name}`, { key: role.key }, null);
  refresh();
  return { ok: true, data: { roleId } };
}

function customRoleKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  return `custom_${slug || "role"}_${crypto.randomUUID().slice(0, 8)}`;
}
