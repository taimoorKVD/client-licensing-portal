"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/auth/admin";
import {
  guardCreateUserEmail,
  guardProtectedStaff,
  guardRoleEdit,
  type AccessScope,
} from "@/lib/auth/access";
import { requireStaffPermission } from "@/lib/auth/session";
import { appPath } from "@/lib/paths";
import {
  assignRoleSchema,
  createUserSchema,
  roleDraftSchema,
  roleSlugFromName,
  roleUpdateSchema,
  userIdSchema,
} from "@/lib/auth/schemas";

export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

const RESERVED_SLUGS = new Set(["super_admin", "cml_operator", "pharmacy_admin", "pharmacy_viewer"]);

export async function createPortalUser(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireStaffPermission("staff.users.manage");
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName"),
    password: formData.get("password"),
    actorKind: formData.get("actorKind"),
    roleId: formData.get("roleId"),
    organizationId: formData.get("organizationId") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };

  const reserved = guardCreateUserEmail(parsed.data.email);
  if (!reserved.ok) return reserved;

  const role = await loadRole(session.supabase, parsed.data.roleId);
  if (!role || role.scope !== parsed.data.actorKind) {
    return { ok: false, error: "Choose a role from the same side of the portal as the account." };
  }
  if (parsed.data.actorKind === "tenant") {
    const organizationId = parsed.data.organizationId;
    if (!organizationId) return { ok: false, error: "Choose a pharmacy." };
    const { data: organization, error } = await session.supabase
      .from("organizations")
      .select("id")
      .eq("id", organizationId)
      .maybeSingle();
    if (error || !organization) return { ok: false, error: "That pharmacy is not in the book." };
  }

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    const message = created.error?.message.toLowerCase() ?? "";
    if (message.includes("already")) return { ok: false, error: "An account with that email already exists." };
    return { ok: false, error: "The account was not created." };
  }

  const userId = created.data.user.id;
  const { error: profileError } = await session.supabase.from("profiles").insert({
    user_id: userId,
    email: parsed.data.email,
    display_name: parsed.data.displayName,
    actor_kind: parsed.data.actorKind,
    mfa_required: parsed.data.actorKind === "staff",
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: "The account was not created." };
  }

  if (parsed.data.actorKind === "staff") {
    const { error } = await session.supabase.from("staff_assignments").insert({
      user_id: userId,
      role_id: parsed.data.roleId,
      protected: false,
    });
    if (error) {
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: "The staff role was not assigned." };
    }
  } else {
    const { error } = await session.supabase.from("memberships").insert({
      user_id: userId,
      organization_id: parsed.data.organizationId,
      role_id: parsed.data.roleId,
    });
    if (error) {
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, error: "The pharmacy membership was not assigned." };
    }
  }

  revalidatePath(appPath("/admin/users"));
  return {
    ok: true,
    message: "Account created. Share the password through a channel you already trust. It is not stored in the audit log.",
  };
}

export async function assignPortalRole(input: {
  userId: string;
  roleId: string;
  organizationId?: string;
}): Promise<ActionResult> {
  const session = await requireStaffPermission("staff.users.manage");
  const parsed = assignRoleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choose a valid account and role." };
  if (parsed.data.userId === session.actor.userId) {
    return { ok: false, error: "Change another account. Your own role stays put in this screen." };
  }

  const target = await loadTarget(session.supabase, parsed.data.userId);
  if (!target) return { ok: false, error: "That account is not on the portal." };
  const locked = guardProtectedStaff({
    email: target.email,
    protected: target.protected,
    action: "change_role",
  });
  if (!locked.ok) return locked;

  const role = await loadRole(session.supabase, parsed.data.roleId);
  if (!role || role.scope !== target.kind) {
    return { ok: false, error: "That role belongs to the other side of the portal." };
  }

  if (target.kind === "staff") {
    const { data, error } = await session.supabase
      .from("staff_assignments")
      .update({ role_id: role.id, protected: false })
      .eq("user_id", target.userId)
      .eq("protected", false)
      .select("user_id");
    if (error || !data?.length) return { ok: false, error: "The role was not changed." };
  } else {
    if (!parsed.data.organizationId) return { ok: false, error: "Choose a pharmacy." };
    const { data, error } = await session.supabase
      .from("memberships")
      .update({ role_id: role.id, organization_id: parsed.data.organizationId })
      .eq("user_id", target.userId)
      .select("id");
    if (error || !data?.length) return { ok: false, error: "The membership was not changed." };
  }

  revalidatePath(appPath("/admin/users"));
  return { ok: true, message: "Role updated." };
}

export async function setPortalUserDisabled(userId: string, disabled: boolean): Promise<ActionResult> {
  const session = await requireStaffPermission("staff.users.manage");
  const parsed = userIdSchema.safeParse({ userId });
  if (!parsed.success) return { ok: false, error: "That account is not valid." };
  if (parsed.data.userId === session.actor.userId) {
    return { ok: false, error: "You cannot disable the account you are using." };
  }
  const target = await loadTarget(session.supabase, parsed.data.userId);
  if (!target) return { ok: false, error: "That account is not on the portal." };
  if (disabled) {
    const locked = guardProtectedStaff({
      email: target.email,
      protected: target.protected,
      action: "disable",
    });
    if (!locked.ok) return locked;
  }

  const { data, error } = await session.supabase
    .from("profiles")
    .update({ disabled_at: disabled ? new Date().toISOString() : null })
    .eq("user_id", target.userId)
    .select("user_id");
  if (error || !data?.length) return { ok: false, error: "The account was not updated." };

  const admin = createAdminClient();
  const banned = await admin.auth.admin.updateUserById(target.userId, {
    ban_duration: disabled ? "876000h" : "none",
  });
  if (banned.error) return { ok: false, error: "The profile changed, but the sign-in ban did not." };

  revalidatePath(appPath("/admin/users"));
  return { ok: true, message: disabled ? "Account disabled." : "Account enabled." };
}

export async function deletePortalUser(userId: string): Promise<ActionResult> {
  const session = await requireStaffPermission("staff.users.manage");
  const parsed = userIdSchema.safeParse({ userId });
  if (!parsed.success) return { ok: false, error: "That account is not valid." };
  if (parsed.data.userId === session.actor.userId) {
    return { ok: false, error: "You cannot delete the account you are using." };
  }
  const target = await loadTarget(session.supabase, parsed.data.userId);
  if (!target) return { ok: false, error: "That account is not on the portal." };
  const locked = guardProtectedStaff({
    email: target.email,
    protected: target.protected,
    action: "delete",
  });
  if (!locked.ok) return locked;

  const admin = createAdminClient();
  const removed = await admin.auth.admin.deleteUser(target.userId);
  if (removed.error) {
    if (removed.error.message.toLowerCase().includes("protected super admin")) {
      return { ok: false, error: "The protected super admin cannot be deleted." };
    }
    return { ok: false, error: "The account was not deleted." };
  }

  revalidatePath(appPath("/admin/users"));
  return { ok: true, message: "Account deleted." };
}

export async function createPortalRole(_state: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await requireStaffPermission("staff.roles.manage");
  const parsed = roleDraftSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    scope: formData.get("scope"),
    permissions: formData.getAll("permissions"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the role." };

  const slug = roleSlugFromName(parsed.data.name);
  if (!slug || RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: "Choose a name that does not match a system role." };
  }
  const scopeCheck = guardRoleEdit(
    { slug, scope: parsed.data.scope, system: false, protected: false },
    { permissions: parsed.data.permissions },
  );
  if (!scopeCheck.ok) return scopeCheck;

  const { data: role, error } = await session.supabase
    .from("roles")
    .insert({
      scope: parsed.data.scope,
      slug,
      name: parsed.data.name,
      description: parsed.data.description,
      system: false,
      protected: false,
    })
    .select("id")
    .maybeSingle();
  if (error || !role) return { ok: false, error: "The role was not created." };

  const { error: permissionError } = await session.supabase.from("role_permissions").insert(
    parsed.data.permissions.map((permission) => ({
      role_id: (role as { id: string }).id,
      permission_key: permission,
    })),
  );
  if (permissionError) {
    await session.supabase.from("roles").delete().eq("id", (role as { id: string }).id);
    return { ok: false, error: "The role permissions were not saved." };
  }

  revalidatePath(appPath("/admin/roles"));
  return { ok: true, message: "Role created." };
}

export async function updatePortalRole(input: {
  roleId: string;
  name: string;
  description: string;
  scope: AccessScope;
  permissions: string[];
}): Promise<ActionResult> {
  const session = await requireStaffPermission("staff.roles.manage");
  const parsed = roleUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the role." };

  const role = await loadRole(session.supabase, parsed.data.roleId);
  if (!role) return { ok: false, error: "That role does not exist." };
  const guard = guardRoleEdit(role, {
    slug: role.slug,
    scope: role.scope,
    permissions: parsed.data.permissions,
  });
  if (!guard.ok) return guard;
  if (parsed.data.scope !== role.scope) {
    return { ok: false, error: "Role scope stays as it was created." };
  }

  const { error: updateError } = await session.supabase
    .from("roles")
    .update({ name: parsed.data.name, description: parsed.data.description })
    .eq("id", role.id);
  if (updateError) return { ok: false, error: "The role was not updated." };

  const { data: existing, error: existingError } = await session.supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", role.id);
  if (existingError) return { ok: false, error: "The role permissions could not be read." };
  const current = new Set(((existing ?? []) as { permission_key: string }[]).map((row) => row.permission_key));
  const next = new Set<string>(parsed.data.permissions);
  const toAdd = [...next].filter((key) => !current.has(key));
  const toRemove = [...current].filter((key) => !next.has(key));

  if (toAdd.length > 0) {
    const { error } = await session.supabase.from("role_permissions").insert(
      toAdd.map((permission) => ({ role_id: role.id, permission_key: permission })),
    );
    if (error) return { ok: false, error: "The new permissions were not saved." };
  }
  if (toRemove.length > 0) {
    const { error } = await session.supabase
      .from("role_permissions")
      .delete()
      .eq("role_id", role.id)
      .in("permission_key", toRemove);
    if (error) return { ok: false, error: "Super admin permissions cannot be changed." };
  }

  revalidatePath(appPath("/admin/roles"));
  return { ok: true, message: "Role updated." };
}

export async function deletePortalRole(roleId: string): Promise<ActionResult> {
  const session = await requireStaffPermission("staff.roles.manage");
  const role = await loadRole(session.supabase, roleId);
  if (!role) return { ok: false, error: "That role does not exist." };
  const guard = guardRoleEdit(role, { delete: true });
  if (!guard.ok) return guard;

  const { error } = await session.supabase.from("roles").delete().eq("id", role.id);
  if (error) return { ok: false, error: "Reassign accounts before deleting this role." };
  revalidatePath(appPath("/admin/roles"));
  return { ok: true, message: "Role deleted." };
}

type RoleRecord = {
  id: string;
  slug: string;
  scope: AccessScope;
  system: boolean;
  protected: boolean;
};

async function loadRole(
  supabase: Awaited<ReturnType<typeof requireStaffPermission>>["supabase"],
  roleId: string,
): Promise<RoleRecord | null> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, slug, scope, system, protected")
    .eq("id", roleId)
    .maybeSingle();
  if (error || !data) return null;
  return data as RoleRecord;
}

async function loadTarget(
  supabase: Awaited<ReturnType<typeof requireStaffPermission>>["supabase"],
  userId: string,
): Promise<{ userId: string; email: string; kind: "staff" | "tenant"; protected: boolean } | null> {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, email, actor_kind")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !profile) return null;
  const row = profile as { user_id: string; email: string; actor_kind: "staff" | "tenant" };
  const { data: assignment } = await supabase
    .from("staff_assignments")
    .select("protected")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    userId: row.user_id,
    email: row.email,
    kind: row.actor_kind,
    protected: Boolean((assignment as { protected?: boolean } | null)?.protected),
  };
}
