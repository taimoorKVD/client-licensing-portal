"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assignPortalRole,
  createPortalUser,
  deletePortalUser,
  setPortalUserDisabled,
  type ActionResult,
} from "@/lib/auth/admin-actions";
import { PROTECTED_SUPER_ADMIN_EMAIL } from "@/lib/auth/access";
import type { ManagedRole, ManagedUser, OrganizationOption } from "@/lib/auth/directory";
import { toast } from "sonner";

export function UserAdmin({
  users,
  roles,
  organizations,
  canManage,
}: {
  users: ManagedUser[];
  roles: ManagedRole[];
  organizations: OrganizationOption[];
  canManage: boolean;
}) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Accounts"
        title={"People,\nnot a public signup."}
        description="CML staff and pharmacy users are issued here. The protected super admin cannot be demoted or deleted."
      />
      {canManage ? <CreateUser roles={roles} organizations={organizations} /> : null}
      <UserTable users={users} roles={roles} organizations={organizations} canManage={canManage} />
    </div>
  );
}

function CreateUser({
  roles,
  organizations,
}: {
  roles: ManagedRole[];
  organizations: OrganizationOption[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState<"staff" | "tenant">("staff");
  const [state, action, pending] = useActionState(
    async (previous: ActionResult | null, formData: FormData) => {
      const result = await createPortalUser(previous, formData);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      }
      return result;
    },
    null,
  );
  const choices = roles.filter((role) => role.scope === kind && !role.protected);

  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold">Issue an account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {PROTECTED_SUPER_ADMIN_EMAIL} is reserved. Create that Auth user in the Supabase dashboard, then run the
          bootstrap function. Do not put its password in this form.
        </p>
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-destructive sm:col-span-2" role="alert">
          {state.error}
        </p>
      ) : null}
      <Field label="Name" name="displayName" />
      <Field label="Email" name="email" type="email" />
      <Field label="Initial password" name="password" type="password" />
      <div className="grid gap-2">
        <Label htmlFor="actorKind">Side of the portal</Label>
        <select
          id="actorKind"
          name="actorKind"
          value={kind}
          onChange={(event) => setKind(event.target.value as "staff" | "tenant")}
          className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="staff">CML staff</option>
          <option value="tenant">Pharmacy user</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="roleId">Role</Label>
        <select id="roleId" name="roleId" className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm" required>
          {choices.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>
      {kind === "tenant" ? (
        <div className="grid gap-2">
          <Label htmlFor="organizationId">Pharmacy</Label>
          <select
            id="organizationId"
            name="organizationId"
            className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            required
          >
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, name, type = "text" }: { label: string; name: string; type?: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required className="h-10" />
    </div>
  );
}

function UserTable({
  users,
  roles,
  organizations,
  canManage,
}: {
  users: ManagedUser[];
  roles: ManagedRole[];
  organizations: OrganizationOption[];
  canManage: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[44rem] text-left text-sm">
        <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Account</th>
            <th className="px-4 py-3 font-medium">Side</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.userId} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <p className="font-medium">{user.displayName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </td>
              <td className="px-4 py-3">{user.kind === "staff" ? "CML staff" : "Pharmacy"}</td>
              <td className="px-4 py-3">
                <p>{user.roleName}</p>
                {user.organizationName ? <p className="text-xs text-muted-foreground">{user.organizationName}</p> : null}
                {canManage ? (
                  <RoleEditor user={user} roles={roles} organizations={organizations} />
                ) : null}
              </td>
              <td className="px-4 py-3">
                {user.protected ? <p>Protected super admin</p> : null}
                {user.disabled ? <p>Disabled</p> : <p>Active</p>}
                {canManage && !user.protected ? <AccountControls user={user} /> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoleEditor({
  user,
  roles,
  organizations,
}: {
  user: ManagedUser;
  roles: ManagedRole[];
  organizations: OrganizationOption[];
}) {
  const router = useRouter();
  const [roleId, setRoleId] = useState(user.roleId);
  const [organizationId, setOrganizationId] = useState(user.organizationId ?? organizations[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const choices = roles.filter((role) => role.scope === user.kind);
  if (user.protected) return null;

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        const result = await assignPortalRole({
          userId: user.userId,
          roleId,
          organizationId: user.kind === "tenant" ? organizationId : undefined,
        });
        setPending(false);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message);
        router.refresh();
      }}
    >
      <select
        aria-label={`Role for ${user.displayName}`}
        value={roleId}
        onChange={(event) => setRoleId(event.target.value)}
        className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
      >
        {choices.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
      {user.kind === "tenant" ? (
        <select
          aria-label={`Pharmacy for ${user.displayName}`}
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs"
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      ) : null}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Save role
      </Button>
    </form>
  );
}

function AccountControls({ user }: { user: ManagedUser }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<ActionResult>) {
    setPending(true);
    const result = await action();
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    router.refresh();
  }

  return (
    <div className="mt-2 flex gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run(() => setPortalUserDisabled(user.userId, !user.disabled))}
      >
        {user.disabled ? "Enable" : "Disable"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Delete ${user.email}?`)) {
            void run(() => deletePortalUser(user.userId));
          }
        }}
      >
        Delete
      </Button>
    </div>
  );
}
