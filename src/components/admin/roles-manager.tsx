"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteRoleAction, saveRoleAction } from "@/lib/auth/admin-actions";
import { PERMISSIONS, type ActorKind } from "@/lib/auth/catalog";
import type { RoleRecord } from "@/lib/auth/directory";
import type { PortalSession } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RolesManager({ session, roles }: { session: PortalSession; roles: RoleRecord[] }) {
  const canManage = session.permissions.includes("roles.manage");

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Access</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Roles</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Custom roles bundle the fixed permissions. The super admin role stays complete and cannot be edited. You cannot grant a CML permission you do not hold, and you cannot edit your own role.
        </p>
      </header>
      <ul className="grid gap-3">
        {roles.map((role) => (
          <li key={role.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{role.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {role.scope === "staff" ? "CML staff" : "Pharmacy"} · {role.key}
                  {role.protected ? " · Protected" : ""}
                  {role.system ? " · System" : ""}
                </p>
                {role.description ? <p className="mt-2 text-sm text-muted-foreground">{role.description}</p> : null}
              </div>
              {canManage && !role.system && !role.protected && role.id !== session.roleId ? (
                <form action={deleteRoleAction}>
                  <input type="hidden" name="roleId" value={role.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    Delete
                  </Button>
                </form>
              ) : null}
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {role.permissions.map((permission) => (
                <li key={permission} className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground">
                  {permission}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {canManage ? (
        <RoleForm roles={roles} actorPermissions={session.permissions} actorRoleId={session.roleId} />
      ) : null}
    </div>
  );
}

function RoleForm({
  roles,
  actorPermissions,
  actorRoleId,
}: {
  roles: RoleRecord[];
  actorPermissions: string[];
  actorRoleId: string | null;
}) {
  const router = useRouter();
  const editable = roles.filter((role) => !role.protected && role.id !== actorRoleId);
  const [roleId, setRoleId] = useState("");
  const selected = editable.find((role) => role.id === roleId);
  const [scope, setScope] = useState<ActorKind>("staff");
  const activeScope = selected?.scope ?? scope;
  const [state, action, pending] = useActionState(saveRoleAction, null);
  const choices = PERMISSIONS.filter((permission) => permission.scope === activeScope).filter(
    (permission) => permission.scope === "tenant" || actorPermissions.includes(permission.key),
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [router, state]);

  return (
    <form key={roleId || "new"} action={action} className="grid gap-4 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">{selected ? "Edit role" : "New role"}</h2>
      <label className="grid gap-2 text-sm font-medium">
        Existing role
        <select
          value={roleId}
          onChange={(event) => {
            const next = event.target.value;
            setRoleId(next);
            const match = editable.find((role) => role.id === next);
            if (match) setScope(match.scope);
          }}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">Create a new role</option>
          {editable.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </label>
      {selected ? <input type="hidden" name="roleId" value={selected.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="role-name">Name</Label>
          <Input id="role-name" name="name" required defaultValue={selected?.name ?? ""} />
        </div>
        <label className="grid gap-2 text-sm font-medium">
          Scope
          {selected ? <input type="hidden" name="scope" value={selected.scope} /> : null}
          <select
            name={selected ? undefined : "scope"}
            value={activeScope}
            disabled={Boolean(selected)}
            onChange={(event) => setScope(event.target.value as ActorKind)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm disabled:opacity-60"
          >
            <option value="staff">CML staff</option>
            <option value="tenant">Pharmacy</option>
          </select>
        </label>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="role-description">Description</Label>
        <Input id="role-description" name="description" defaultValue={selected?.description ?? ""} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Permissions</legend>
        {choices.map((permission) => (
          <label key={permission.key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="permissions"
              value={permission.key}
              defaultChecked={selected?.permissions.includes(permission.key) ?? false}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{permission.label}</span>
              <span className="block text-xs text-muted-foreground">{permission.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {state?.message ? (
        <p className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{state.message}</p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : selected ? "Save role" : "Create role"}
        </Button>
      </div>
    </form>
  );
}
