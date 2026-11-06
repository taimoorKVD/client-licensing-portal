"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/portal/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPortalRole, deletePortalRole, updatePortalRole, type ActionResult } from "@/lib/auth/admin-actions";
import {
  PERMISSION_LABEL,
  permissionsForScope,
  type AccessScope,
  type Permission,
} from "@/lib/auth/access";
import type { ManagedRole } from "@/lib/auth/directory";
import { toast } from "sonner";

export function RoleAdmin({ roles }: { roles: ManagedRole[] }) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Roles"
        title={"Permissions,\nkept on the server."}
        description="Custom roles can be edited. The super admin role stays locked, and a pharmacy role cannot receive CML staff permissions."
      />
      <CreateRole />
      <div className="grid gap-4">
        {roles.map((role) => (
          <RoleCard key={role.id} role={role} />
        ))}
      </div>
    </div>
  );
}

function CreateRole() {
  const router = useRouter();
  const [scope, setScope] = useState<AccessScope>("staff");
  const [state, action, pending] = useActionState(
    async (previous: ActionResult | null, formData: FormData) => {
      const result = await createPortalRole(previous, formData);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      }
      return result;
    },
    null,
  );

  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-border bg-card p-4">
      <h2 className="text-lg font-semibold">New role</h2>
      {state && !state.ok ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required className="h-10" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="scope">Scope</Label>
          <select
            id="scope"
            name="scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as AccessScope)}
            className="h-10 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="staff">CML staff</option>
            <option value="tenant">Pharmacy</option>
          </select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" className="h-10" />
      </div>
      <PermissionChoices key={scope} scope={scope} selected={[]} />
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Create role"}
      </Button>
    </form>
  );
}

function RoleCard({ role }: { role: ManagedRole }) {
  const router = useRouter();
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [selected, setSelected] = useState<Permission[]>(role.permissions);
  const [pending, setPending] = useState(false);
  const locked = role.protected || role.slug === "super_admin";

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{role.name}</h2>
          <p className="text-xs text-muted-foreground">
            {role.scope === "staff" ? "CML staff" : "Pharmacy"} · {role.slug}
            {role.system ? " · System" : ""}
            {locked ? " · Locked" : ""}
          </p>
        </div>
        {!role.system && !locked ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const result = await deletePortalRole(role.id);
              setPending(false);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success(result.message);
              router.refresh();
            }}
          >
            Delete
          </Button>
        ) : null}
      </div>
      <form
        className="mt-4 grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          const result = await updatePortalRole({
            roleId: role.id,
            name,
            description,
            scope: role.scope,
            permissions: selected,
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
        <div className="grid gap-3 sm:grid-cols-2">
          <Input aria-label="Role name" value={name} onChange={(event) => setName(event.target.value)} disabled={locked} />
          <Input
            aria-label="Role description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={locked}
          />
        </div>
        <PermissionChoices
          scope={role.scope}
          selected={selected}
          disabled={locked}
          onChange={setSelected}
        />
        {locked ? (
          <p className="text-sm text-muted-foreground">Super admin permissions cannot be changed.</p>
        ) : (
          <Button type="submit" size="sm" disabled={pending} className="w-fit">
            Save role
          </Button>
        )}
      </form>
    </article>
  );
}

function PermissionChoices({
  scope,
  selected,
  disabled = false,
  onChange,
}: {
  scope: AccessScope;
  selected: readonly Permission[];
  disabled?: boolean;
  onChange?: (next: Permission[]) => void;
}) {
  const choices = permissionsForScope(scope);
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="mb-1 text-sm font-medium">Permissions</legend>
      {choices.map((permission) => {
        const checked = selected.includes(permission);
        return (
          <label key={permission} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="permissions"
              value={permission}
              checked={onChange ? checked : undefined}
              defaultChecked={onChange ? undefined : checked}
              disabled={disabled}
              onChange={
                onChange
                  ? (event) => {
                      const next = event.target.checked
                        ? [...selected, permission]
                        : selected.filter((item) => item !== permission);
                      onChange(next);
                    }
                  : undefined
              }
            />
            <span>{PERMISSION_LABEL[permission]}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
