"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { PendingLabel } from "@/components/portal/brand-loader";
import { EmptyState } from "@/components/portal/empty-state";
import { InlineNotice } from "@/components/portal/inline-notice";
import { PageHeader } from "@/components/portal/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        actions={
          canManage ? (
            <a href="#issue-account" className={buttonVariants()}>
              Issue account
            </a>
          ) : null
        }
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
    <form id="issue-account" action={action} className="grid scroll-mt-24 gap-4 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)] sm:grid-cols-2 sm:p-5">
      <div className="sm:col-span-2">
        <h2 className="text-lg font-semibold tracking-tight">Issue an account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {PROTECTED_SUPER_ADMIN_EMAIL} is reserved. Create that Auth user in the Supabase dashboard, then run the
          bootstrap function. Do not put its password in this form.
        </p>
      </div>
      {state && !state.ok ? (
        <InlineNotice tone="error" className="sm:col-span-2">
          {state.error}
        </InlineNotice>
      ) : null}
      <Field label="Name" name="displayName" />
      <Field label="Email" name="email" type="email" />
      <Field label="Initial password" name="password" type="password" />
      <div className="grid gap-2">
        <Label htmlFor="actorKind">Side of the portal</Label>
        <NativeSelect
          id="actorKind"
          name="actorKind"
          value={kind}
          onChange={(event) => setKind(event.target.value as "staff" | "tenant")}
        >
          <option value="staff">CML staff</option>
          <option value="tenant">Pharmacy user</option>
        </NativeSelect>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="roleId">Role</Label>
        <NativeSelect id="roleId" name="roleId" required>
          {choices.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      {kind === "tenant" ? (
        <div className="grid gap-2">
          <Label htmlFor="organizationId">Pharmacy</Label>
          <NativeSelect id="organizationId" name="organizationId" required>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          <PendingLabel pending={pending} idle="Create account" busy="Creating…" />
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
  if (users.length === 0) {
    return (
      <EmptyState
        framed
        icon="users"
        title="No accounts yet"
        description="Issued staff and pharmacy users will show up here."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead>Side</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.userId}>
              <TableCell className="whitespace-normal">
                <p className="font-medium">{user.displayName}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </TableCell>
              <TableCell>{user.kind === "staff" ? "CML staff" : "Pharmacy"}</TableCell>
              <TableCell className="whitespace-normal">
                <p>{user.roleName}</p>
                {user.organizationName ? <p className="text-xs text-muted-foreground">{user.organizationName}</p> : null}
                {canManage ? (
                  <RoleEditor user={user} roles={roles} organizations={organizations} />
                ) : null}
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-wrap gap-1.5">
                  {user.protected ? <StatusPill>Protected super admin</StatusPill> : null}
                  <StatusPill tone={user.disabled ? "muted" : "good"}>{user.disabled ? "Disabled" : "Active"}</StatusPill>
                </div>
                {canManage && !user.protected ? <AccountControls user={user} /> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusPill({ children, tone = "muted" }: { children: string; tone?: "good" | "muted" }) {
  return (
    <span
      className={
        tone === "good"
          ? "inline-flex rounded-full border border-primary/25 bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground"
          : "inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
      }
    >
      {children}
    </span>
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
      <NativeSelect
        aria-label={`Role for ${user.displayName}`}
        value={roleId}
        onChange={(event) => setRoleId(event.target.value)}
        className="h-8 w-auto text-xs"
      >
        {choices.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </NativeSelect>
      {user.kind === "tenant" ? (
        <NativeSelect
          aria-label={`Pharmacy for ${user.displayName}`}
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          className="h-8 w-auto text-xs"
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        <PendingLabel pending={pending} idle="Save role" busy="Saving…" />
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
        <PendingLabel pending={pending} idle={user.disabled ? "Enable" : "Disable"} busy="Saving…" />
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
        <PendingLabel pending={pending} idle="Delete" busy="Deleting…" />
      </Button>
    </div>
  );
}
