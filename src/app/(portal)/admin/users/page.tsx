import type { Metadata } from "next";
import { EmptyState } from "@/components/portal/empty-state";
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
    return (
      <EmptyState
        framed
        icon="unplug"
        title="Supabase is required"
        description="Accounts are issued when Supabase Auth is configured."
      />
    );
  }
  const session = await requirePortalSession();
  if (!hasPermission(session.actor, "staff.users.read")) {
    return (
      <EmptyState
        framed
        icon="lock"
        title="Restricted"
        description="You do not have access to accounts."
      />
    );
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
