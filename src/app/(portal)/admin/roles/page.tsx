import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RolesManager } from "@/components/admin/roles-manager";
import { loadRoles } from "@/lib/auth/directory";
import { isSupabaseConfigured } from "@/lib/env";
import { requirePortalSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Roles",
};

export default async function RolesPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const session = await requirePortalSession();
  if (!session.permissions.includes("roles.read") && !session.permissions.includes("roles.manage")) {
    return (
      <div>
        <h1 className="text-3xl font-semibold">Roles</h1>
        <p className="mt-2 text-sm text-muted-foreground">You cannot view roles.</p>
      </div>
    );
  }
  const roles = await loadRoles();
  return <RolesManager session={session} roles={roles} />;
}
