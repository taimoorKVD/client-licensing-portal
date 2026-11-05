import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActorKind } from "@/lib/auth/catalog";
import type { Assurance, Principal } from "@/lib/auth/policy";
import type { PortalSession } from "@/lib/auth/types";

type AccountRow = {
  user_id: string;
  email: string;
  display_name: string;
  actor_kind: ActorKind;
  disabled_at: string | null;
  protected_admin: boolean;
  role_id: string | null;
  role_key: string | null;
  role_name: string | null;
  permissions: string[] | null;
  organization_ids: string[] | null;
};

export const readSession = cache(async (): Promise<PortalSession | null> => {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data: claimsData } = await supabase.auth.getClaims();
  const aal: Assurance = claimsData?.claims.aal === "aal2" ? "aal2" : "aal1";
  const { data: account } = await supabase
    .from("my_account")
    .select("*")
    .maybeSingle<AccountRow>();

  if (!account) {
    return {
      provisioned: false,
      userId: userData.user.id,
      email: userData.user.email ?? "",
      displayName: userData.user.email ?? "Signed in",
      actorKind: "tenant",
      roleId: null,
      roleKey: null,
      roleName: null,
      permissions: [],
      organizationIds: [],
      protectedAdmin: false,
      disabled: false,
      aal,
      label: userData.user.email ?? "Signed in",
      detail: "No directory profile",
    };
  }

  const organizationIds = account.organization_ids ?? [];
  let label = account.display_name;
  if (account.actor_kind === "tenant" && organizationIds.length === 1) {
    const { data: organization } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationIds[0])
      .maybeSingle<{ name: string }>();
    if (organization?.name) label = organization.name;
  }

  return {
    provisioned: true,
    userId: account.user_id,
    email: account.email,
    displayName: account.display_name,
    actorKind: account.actor_kind,
    roleId: account.role_id,
    roleKey: account.role_key,
    roleName: account.role_name,
    permissions: account.permissions ?? [],
    organizationIds,
    protectedAdmin: account.protected_admin,
    disabled: account.disabled_at !== null,
    aal,
    label,
    detail: account.role_name ?? (account.actor_kind === "staff" ? "CML staff" : "Pharmacy"),
  };
});

export function toPrincipal(session: PortalSession): Principal {
  return {
    userId: session.userId,
    email: session.email,
    actorKind: session.actorKind,
    permissions: session.permissions,
    organizationIds: session.organizationIds,
    protectedAdmin: session.protectedAdmin,
    disabled: session.disabled,
    aal: session.aal,
    roleId: session.roleId,
  };
}

export const requirePortalSession = cache(async (): Promise<PortalSession> => {
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.provisioned) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?notice=unprovisioned");
  }
  if (session.disabled) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?notice=disabled");
  }
  if (session.actorKind === "staff" && session.aal !== "aal2") {
    redirect("/mfa");
  }
  return session;
});
