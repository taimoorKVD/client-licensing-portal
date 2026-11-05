import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPermission, type Permission } from "@/lib/auth/access";
import type { ManagedRole, ManagedUser, OrganizationOption } from "@/lib/auth/directory";

type ProfileRow = {
  user_id: string;
  email: string;
  display_name: string;
  actor_kind: "staff" | "tenant";
  disabled_at: string | null;
};

type RoleRow = {
  id: string;
  scope: "staff" | "tenant";
  slug: string;
  name: string;
  description: string;
  system: boolean;
  protected: boolean;
};

export async function loadDirectory(supabase: SupabaseClient): Promise<{
  users: ManagedUser[];
  roles: ManagedRole[];
  organizations: OrganizationOption[];
}> {
  const [profiles, roles, permissions, assignments, memberships, organizations] = await Promise.all([
    supabase.from("profiles").select("user_id, email, display_name, actor_kind, disabled_at").order("email"),
    supabase.from("roles").select("id, scope, slug, name, description, system, protected").order("name"),
    supabase.from("role_permissions").select("role_id, permission_key"),
    supabase.from("staff_assignments").select("user_id, role_id, protected"),
    supabase.from("memberships").select("user_id, role_id, organization_id"),
    supabase.from("organizations").select("id, name").order("name"),
  ]);

  for (const result of [profiles, roles, permissions, assignments, memberships, organizations]) {
    if (result.error) throw result.error;
  }

  const roleRows = (roles.data ?? []) as RoleRow[];
  const permissionRows = (permissions.data ?? []) as { role_id: string; permission_key: string }[];
  const permissionsByRole = new Map<string, Permission[]>();
  for (const row of permissionRows) {
    if (!isPermission(row.permission_key)) continue;
    const list = permissionsByRole.get(row.role_id) ?? [];
    list.push(row.permission_key);
    permissionsByRole.set(row.role_id, list);
  }

  const managedRoles: ManagedRole[] = roleRows.map((role) => ({
    id: role.id,
    scope: role.scope,
    slug: role.slug,
    name: role.name,
    description: role.description,
    system: role.system,
    protected: role.protected,
    permissions: permissionsByRole.get(role.id) ?? [],
  }));
  const roleById = new Map(managedRoles.map((role) => [role.id, role]));
  const organizationRows = (organizations.data ?? []) as OrganizationOption[];
  const organizationName = new Map(organizationRows.map((organization) => [organization.id, organization.name]));
  const assignmentByUser = new Map(
    ((assignments.data ?? []) as { user_id: string; role_id: string; protected: boolean }[]).map((row) => [
      row.user_id,
      row,
    ]),
  );
  const membershipByUser = new Map(
    ((memberships.data ?? []) as { user_id: string; role_id: string; organization_id: string }[]).map((row) => [
      row.user_id,
      row,
    ]),
  );

  const users: ManagedUser[] = ((profiles.data ?? []) as ProfileRow[]).map((profile) => {
    const assignment = assignmentByUser.get(profile.user_id);
    const membership = membershipByUser.get(profile.user_id);
    const roleId = assignment?.role_id ?? membership?.role_id ?? "";
    const role = roleById.get(roleId);
    const organizationId = membership?.organization_id ?? null;
    return {
      userId: profile.user_id,
      email: profile.email,
      displayName: profile.display_name,
      kind: profile.actor_kind,
      roleId,
      roleSlug: role?.slug ?? "",
      roleName: role?.name ?? "Unassigned",
      organizationId,
      organizationName: organizationId ? (organizationName.get(organizationId) ?? "Pharmacy") : null,
      protected: Boolean(assignment?.protected),
      disabled: Boolean(profile.disabled_at),
    };
  });

  return { users, roles: managedRoles, organizations: organizationRows };
}
