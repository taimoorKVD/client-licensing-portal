import type { Metadata } from "next";
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
    return <p className="text-sm text-muted-foreground">Roles are available when Supabase Auth is configured.</p>;
  }
  const session = await requirePortalSession();
  if (!hasPermission(session.actor, "staff.roles.manage")) {
    return <p className="text-sm text-muted-foreground">You do not have access to roles.</p>;
  }
  const directory = await loadDirectory(session.supabase);
  return <RoleAdmin roles={directory.roles} />;
}
