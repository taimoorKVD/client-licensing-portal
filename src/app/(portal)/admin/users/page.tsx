import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UsersManager } from "@/components/admin/users-manager";
import { loadDirectory, loadOrganizationOptions, loadRoles } from "@/lib/auth/directory";
import { isSupabaseConfigured } from "@/lib/env";
import { requirePortalSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "People",
};

export default async function UsersPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const session = await requirePortalSession();
  const allowed = ["users.read", "users.manage", "org.users.read", "org.users.manage"].some(
    (permission) => session.permissions.includes(permission),
  );
  if (!allowed) {
    return <Denied title="People" detail="You cannot view the directory." />;
  }

  const [people, roles, organizations] = await Promise.all([
    loadDirectory(),
    loadRoles(),
    loadOrganizationOptions(),
  ]);

  return (
    <UsersManager
      session={session}
      people={people}
      roles={roles}
      organizations={organizations}
    />
  );
}

function Denied({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}
