"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { assignRoleAction, createUserAction, deleteUserAction, setDisabledAction } from "@/lib/auth/admin-actions";
import type { DirectoryEntry, RoleRecord } from "@/lib/auth/directory";
import type { PortalSession } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UsersManager({
  session,
  people,
  roles,
  organizations,
}: {
  session: PortalSession;
  people: DirectoryEntry[];
  roles: RoleRecord[];
  organizations: { id: string; name: string }[];
}) {
  const canManage =
    session.permissions.includes("users.manage") ||
    session.permissions.includes("org.users.manage");
  const visibleRoles =
    session.actorKind === "tenant" ? roles.filter((role) => role.scope === "tenant") : roles;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Directory</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">People</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          CML staff and pharmacy users stay in separate directories. Roles are assigned here. There is no public signup.
        </p>
      </header>

      {canManage ? (
        <CreateUserForm roles={visibleRoles} organizations={organizations} actorKind={session.actorKind} organizationIds={session.organizationIds} />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Directory</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {canManage ? <th className="px-4 py-3 font-medium">Access</th> : null}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <tr key={person.userId} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <span className="block font-medium">{person.displayName}</span>
                  <span className="text-xs text-muted-foreground">{person.email}</span>
                </td>
                <td className="px-4 py-3">
                  {person.actorKind === "staff" ? "CML staff" : person.organizationName ?? "Pharmacy"}
                </td>
                <td className="px-4 py-3">
                  {person.protectedAdmin || !canManage || person.userId === session.userId ? (
                    <>
                      {person.roleName}
                      {person.protectedAdmin ? (
                        <span className="mt-1 block text-xs text-muted-foreground">Protected super admin</span>
                      ) : null}
                    </>
                  ) : (
                    <form action={assignRoleAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="userId" value={person.userId} />
                      <select name="roleId" defaultValue={person.roleId} className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm">
                        {visibleRoles
                          .filter((role) => role.scope === person.actorKind)
                          .map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                      </select>
                      <Button type="submit" variant="outline" size="sm">
                        Save role
                      </Button>
                    </form>
                  )}
                </td>
                <td className="px-4 py-3">{person.disabled ? "Disabled" : "Active"}</td>
                {canManage ? (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {person.protectedAdmin || person.userId === session.userId ? (
                        <span className="text-xs text-muted-foreground">Locked</span>
                      ) : (
                        <>
                          <form action={setDisabledAction}>
                            <input type="hidden" name="userId" value={person.userId} />
                            <input type="hidden" name="disabled" value={person.disabled ? "false" : "true"} />
                            <Button type="submit" variant="outline" size="sm">
                              {person.disabled ? "Enable" : "Disable"}
                            </Button>
                          </form>
                          <form action={deleteUserAction}>
                            <input type="hidden" name="userId" value={person.userId} />
                            <Button type="submit" variant="destructive" size="sm">
                              Delete
                            </Button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateUserForm({
  roles,
  organizations,
  actorKind,
  organizationIds,
}: {
  roles: RoleRecord[];
  organizations: { id: string; name: string }[];
  actorKind: PortalSession["actorKind"];
  organizationIds: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(createUserAction, null);
  const pharmacies = organizations.filter((item) =>
    actorKind === "tenant" ? organizationIds.includes(item.id) : true,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [router, state]);

  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold">New account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The initial password is not stored in the audit log. Staff still enroll an authenticator on first sign-in.
        </p>
      </div>
      <Field label="Name" name="displayName" />
      <Field label="Email" name="email" type="email" />
      <Field label="Initial password" name="password" type="password" autoComplete="new-password" />
      <label className="grid gap-2 text-sm font-medium">
        Directory
        <select name="actorKind" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" defaultValue={actorKind === "tenant" ? "tenant" : "staff"}>
          {actorKind === "staff" ? <option value="staff">CML staff</option> : null}
          <option value="tenant">Pharmacy</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Role
        <select name="roleId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name} ({role.scope === "staff" ? "CML" : "Pharmacy"})
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Pharmacy
        <select name="organizationId" className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm" defaultValue={pharmacies[0]?.id ?? ""}>
          <option value="">None — CML staff</option>
          {pharmacies.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      </label>
      {state?.message ? (
        <p className={state.ok ? "text-sm text-muted-foreground sm:col-span-2" : "text-sm text-destructive sm:col-span-2"}>
          {state.message}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} autoComplete={autoComplete} required />
    </div>
  );
}
