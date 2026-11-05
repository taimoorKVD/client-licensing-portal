import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ActorKind } from "@/lib/auth/catalog";
import type { DirectoryUser, RoleDefinition } from "@/lib/auth/policy";

export type DirectoryEntry = DirectoryUser & {
  displayName: string;
  roleName: string;
  organizationName: string | null;
};

export type RoleRecord = RoleDefinition & {
  name: string;
  description: string;
};

type ProfileRow = {
  user_id: string;
  email: string;
  display_name: string;
  actor_kind: ActorKind;
  disabled_at: string | null;
};

type AssignmentRow = {
  user_id: string;
  role_id: string;
  protected: boolean;
  roles: { key: string; name: string } | { key: string; name: string }[] | null;
};

type MembershipRow = {
  user_id: string;
  organization_id: string;
  role_id: string;
  roles: { key: string; name: string } | { key: string; name: string }[] | null;
  organizations: { name: string } | { name: string }[] | null;
};

type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  scope: ActorKind;
  protected: boolean;
  system: boolean;
  role_permissions: { permission_key: string }[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function loadDirectory(): Promise<DirectoryEntry[]> {
  const supabase = await createClient();
  const [{ data: profiles, error: profileError }, { data: assignments }, { data: memberships }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, email, display_name, actor_kind, disabled_at")
        .order("email"),
      supabase.from("staff_assignments").select("user_id, role_id, protected, roles(key, name)"),
      supabase
        .from("memberships")
        .select("user_id, organization_id, role_id, roles(key, name), organizations(name)"),
    ]);

  if (profileError) throw new Error("The directory could not be loaded.");

  const staff = new Map(
    ((assignments ?? []) as AssignmentRow[]).map((row) => [row.user_id, row]),
  );
  const pharmacy = new Map(
    ((memberships ?? []) as MembershipRow[]).map((row) => [row.user_id, row]),
  );

  return ((profiles ?? []) as ProfileRow[]).map((profile) => {
    const assignment = staff.get(profile.user_id);
    const membership = pharmacy.get(profile.user_id);
    const role = one(assignment?.roles) ?? one(membership?.roles);
    const organization = one(membership?.organizations);
    return {
      userId: profile.user_id,
      email: profile.email,
      displayName: profile.display_name,
      actorKind: profile.actor_kind,
      roleId: assignment?.role_id ?? membership?.role_id ?? "",
      roleKey: role?.key ?? "",
      roleName: role?.name ?? "No role",
      organizationId: membership?.organization_id ?? null,
      organizationName: organization?.name ?? null,
      protectedAdmin: assignment?.protected ?? false,
      disabled: profile.disabled_at !== null,
    };
  });
}

export async function loadRoles(): Promise<RoleRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roles")
    .select("id, key, name, description, scope, protected, system, role_permissions(permission_key)")
    .order("scope")
    .order("name");
  if (error) throw new Error("Roles could not be loaded.");
  return ((data ?? []) as RoleRow[]).map((role) => ({
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    scope: role.scope,
    protected: role.protected,
    system: role.system,
    permissions: (role.role_permissions ?? []).map((item) => item.permission_key).sort(),
  }));
}

export async function loadOrganizationOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").select("id, name").order("name");
  if (error) return [];
  return (data ?? []) as { id: string; name: string }[];
}

export async function loadAuditEvents(): Promise<
  {
    id: string;
    occurredAt: string;
    action: string;
    summary: string;
    actorId: string | null;
    organizationId: string | null;
  }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, occurred_at, action, summary, actor_id, organization_id")
    .order("occurred_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return (data ?? []).map((row) => ({
    id: row.id as string,
    occurredAt: row.occurred_at as string,
    action: row.action as string,
    summary: row.summary as string,
    actorId: (row.actor_id as string | null) ?? null,
    organizationId: (row.organization_id as string | null) ?? null,
  }));
}
