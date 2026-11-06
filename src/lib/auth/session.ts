import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isPermission,
  mfaGate,
  mfaPath,
  type ActorKind,
  type AssuranceLevel,
  type Permission,
  type PortalActor,
} from "@/lib/auth/access";
import { APP_HOME, LOGIN_END_PATH, LOGIN_PATH } from "@/lib/paths";
import { createClient } from "@/lib/supabase/server";

type ProfileRow = {
  user_id: string;
  email: string;
  display_name: string;
  actor_kind: ActorKind;
  mfa_required: boolean;
  disabled_at: string | null;
};

type RoleRow = {
  id: string;
  slug: string;
  name: string;
  scope: "staff" | "tenant";
  description: string;
  system: boolean;
  protected: boolean;
};

export type PortalSession = {
  supabase: SupabaseClient;
  userId: string;
  aal: AssuranceLevel;
  actor: PortalActor;
  verifiedFactorCount: number;
};

export async function verifiedSession(): Promise<{
  supabase: SupabaseClient;
  userId: string;
  aal: AssuranceLevel;
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return {
    supabase,
    userId: data.claims.sub,
    aal: data.claims.aal === "aal2" ? "aal2" : "aal1",
  };
}

export async function verifiedFactorCount(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp.length;
}

export async function loadActor(supabase: SupabaseClient, userId: string): Promise<PortalActor | null> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, email, display_name, actor_kind, mfa_required, disabled_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;
  const row = profile as ProfileRow;
  if (row.disabled_at) return null;

  if (row.actor_kind === "staff") {
    const { data: assignment, error: assignmentError } = await supabase
      .from("staff_assignments")
      .select("role_id, protected")
      .eq("user_id", userId)
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment) return null;
    const role = await loadRole(supabase, assignment.role_id as string);
    if (!role) return null;
    const permissions = await loadPermissions(supabase, role.id);
    return {
      userId,
      email: row.email,
      displayName: row.display_name,
      kind: "staff",
      roleSlug: role.slug,
      roleName: role.name,
      organizationIds: [],
      organizationName: null,
      permissions,
      protected: Boolean(assignment.protected),
    };
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("memberships")
    .select("organization_id, role_id")
    .eq("user_id", userId);
  if (membershipError) throw membershipError;
  const rows = (memberships ?? []) as { organization_id: string; role_id: string }[];
  if (rows.length === 0) return null;
  const primary = await loadRole(supabase, rows[0].role_id);
  if (!primary) return null;
  const permissionSet = new Set<Permission>();
  for (const membership of rows) {
    for (const permission of await loadPermissions(supabase, membership.role_id)) {
      permissionSet.add(permission);
    }
  }
  const organizationIds = rows.map((membership) => membership.organization_id);
  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationIds[0])
    .maybeSingle();

  return {
    userId,
    email: row.email,
    displayName: row.display_name,
    kind: "tenant",
    roleSlug: primary.slug,
    roleName: rows.length > 1 ? "Pharmacy access" : primary.name,
    organizationIds,
    organizationName:
      rows.length > 1
        ? `${rows.length} pharmacies`
        : ((organization as { name: string } | null)?.name ?? "Your pharmacy"),
    permissions: [...permissionSet],
    protected: false,
  };
}

async function loadRole(supabase: SupabaseClient, roleId: string): Promise<RoleRow | null> {
  const { data, error } = await supabase
    .from("roles")
    .select("id, slug, name, scope, description, system, protected")
    .eq("id", roleId)
    .maybeSingle();
  if (error) throw error;
  return (data as RoleRow | null) ?? null;
}

async function loadPermissions(supabase: SupabaseClient, roleId: string): Promise<Permission[]> {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("permission_key")
    .eq("role_id", roleId);
  if (error) throw error;
  return ((data ?? []) as { permission_key: string }[])
    .map((row) => row.permission_key)
    .filter(isPermission);
}

export async function portalDestination(session: {
  supabase: SupabaseClient;
  userId: string;
  aal: AssuranceLevel;
}): Promise<string> {
  const { data: profile, error } = await session.supabase
    .from("profiles")
    .select("actor_kind, disabled_at")
    .eq("user_id", session.userId)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return `${LOGIN_END_PATH}?reason=unprovisioned`;
  if ((profile as { disabled_at: string | null }).disabled_at) return `${LOGIN_END_PATH}?reason=disabled`;
  const kind = (profile as { actor_kind: ActorKind }).actor_kind;
  const factors = await verifiedFactorCount(session.supabase);
  return mfaPath(mfaGate({ kind, verifiedFactorCount: factors, currentLevel: session.aal }));
}

/** Portal pages and mutations. Sends incomplete MFA and unknown accounts away. */
export async function requirePortalSession(): Promise<PortalSession> {
  const session = await verifiedSession();
  if (!session) redirect(LOGIN_PATH);
  const destination = await portalDestination(session);
  if (destination !== APP_HOME) redirect(destination);
  const actor = await loadActor(session.supabase, session.userId);
  if (!actor) redirect(`${LOGIN_END_PATH}?reason=unprovisioned`);
  const factors = await verifiedFactorCount(session.supabase);
  return { ...session, actor, verifiedFactorCount: factors };
}

export async function requireStaffPermission(permission: Permission): Promise<PortalSession> {
  const session = await requirePortalSession();
  if (session.actor.kind !== "staff" || !session.actor.permissions.includes(permission)) {
    redirect(APP_HOME);
  }
  return session;
}
