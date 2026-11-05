import type { Metadata } from "next";
import { UserAdmin } from "./user-admin";
import { hasPermission } from "@/lib/auth/access";
import { loadDirectory } from "@/lib/auth/directory-data";
import { requirePortalSession } from "@/lib/auth/session";
import { getDataSource } from "@/lib/env";

export const metadata: Metadata = {
  title: "Users",
};

export default async function UsersPage() {
  if (getDataSource() !== "supabase") {
    return <p className="text-sm text-muted-foreground">Accounts are issued when Supabase Auth is configured.</p>;
  }
  const session = await requirePortalSession();
  if (!hasPermission(session.actor, "staff.users.read")) {
    return <p className="text-sm text-muted-foreground">You do not have access to accounts.</p>;
  }
  const directory = await loadDirectory(session.supabase);
  return (
    <UserAdmin
      users={directory.users}
      roles={directory.roles}
      organizations={directory.organizations}
      canManage={hasPermission(session.actor, "staff.users.manage")}
    />
  );
}
