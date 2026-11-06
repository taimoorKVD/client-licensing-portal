import type { Metadata } from "next";
import { EmptyState } from "@/components/portal/empty-state";
import { RoleAdmin } from "./role-admin";
import { hasPermission } from "@/lib/auth/access";
import { loadDirectory } from "@/lib/auth/directory-data";
import { requirePortalSession } from "@/lib/auth/session";
import { getDataSource } from "@/lib/env";

export const metadata: Metadata = {
  title: "Roles",
};

export default async function RolesPage() {
  if (getDataSource() !== "supabase") {
    return (
      <EmptyState
        framed
        icon="unplug"
        title="Supabase is required"
        description="Roles are available when Supabase Auth is configured."
      />
    );
  }
  const session = await requirePortalSession();
  if (!hasPermission(session.actor, "staff.roles.manage")) {
    return (
      <EmptyState
        framed
        icon="lock"
        title="Restricted"
        description="You do not have access to roles."
      />
    );
  }
  const directory = await loadDirectory(session.supabase);
  return <RoleAdmin roles={directory.roles} />;
}
