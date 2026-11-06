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
        actions={
          <a href="#new-role" className={buttonVariants()}>
            New role
          </a>
        }
      />
      <CreateRole />
      {roles.length === 0 ? (
        <EmptyState
          framed
          icon="key"
          title="No roles yet"
          description="Custom roles you create will be listed here. System roles stay locked."
        />
      ) : (
        <div className="grid gap-4">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      )}
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
    <form id="new-role" action={action} className="grid scroll-mt-24 gap-4 rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)] sm:p-5">
      <h2 className="text-lg font-semibold tracking-tight">New role</h2>
      {state && !state.ok ? <InlineNotice tone="error">{state.error}</InlineNotice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required className="h-10" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="scope">Scope</Label>
          <NativeSelect
            id="scope"
            name="scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as AccessScope)}
          >
            <option value="staff">CML staff</option>
            <option value="tenant">Pharmacy</option>
          </NativeSelect>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" className="h-10" />
      </div>
      <PermissionChoices key={scope} scope={scope} selected={[]} />
      <Button type="submit" disabled={pending} className="w-fit">
        <PendingLabel pending={pending} idle="Create role" busy="Saving…" />
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
    <article className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)] transition-shadow duration-200 hover:shadow-[0_10px_28px_-18px_oklch(0.45_0.08_155/0.55)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{role.name}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-accent-foreground">
              {role.scope === "staff" ? "CML staff" : "Pharmacy"}
            </span>
            <span>{role.slug}</span>
            {role.system ? <span>· System</span> : null}
            {locked ? <span>· Locked</span> : null}
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
            <PendingLabel pending={pending} idle="Delete" busy="Deleting…" />
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
          <Input aria-label="Role name" value={name} onValueChange={setName} disabled={locked} />
          <Input
            aria-label="Role description"
            value={description}
            onValueChange={setDescription}
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
            <PendingLabel pending={pending} idle="Save role" busy="Saving…" />
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
          <label key={permission} className="flex items-start gap-2.5 rounded-xl border border-transparent px-2 py-2 text-sm transition-colors hover:border-border hover:bg-accent/50 has-[:focus-visible]:border-ring">
            <input
              type="checkbox"
              className="mt-0.5 size-4"
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
