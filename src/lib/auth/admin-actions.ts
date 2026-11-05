"use server";

import {
  assignPortalRole,
  createPortalUser,
  deletePortalRole,
  deletePortalUser,
  savePortalRole,
  setPortalUserDisabled,
} from "@/lib/auth/admin-service";
import type { ActorKind } from "@/lib/auth/catalog";
import type { ActionState } from "@/lib/auth/types";

export async function createUserAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const actorKind = formData.get("actorKind");
  const result = await createPortalUser({
    email: String(formData.get("email") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    password: String(formData.get("password") ?? ""),
    actorKind: actorKind === "tenant" ? "tenant" : "staff",
    roleId: String(formData.get("roleId") ?? ""),
    organizationId: textOrNull(formData.get("organizationId")),
  });
  if (!result.ok) return { message: result.message };
  return { ok: true, message: "Account created. Share the password through a channel you trust." };
}

export async function assignRoleAction(formData: FormData): Promise<void> {
  const result = await assignPortalRole(
    String(formData.get("userId") ?? ""),
    String(formData.get("roleId") ?? ""),
  );
  if (!result.ok) throw new Error(result.message);
}

export async function setDisabledAction(formData: FormData): Promise<void> {
  const result = await setPortalUserDisabled(
    String(formData.get("userId") ?? ""),
    formData.get("disabled") === "true",
  );
  if (!result.ok) throw new Error(result.message);
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const result = await deletePortalUser(String(formData.get("userId") ?? ""));
  if (!result.ok) throw new Error(result.message);
}

export async function saveRoleAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const scopeValue = formData.get("scope");
  const scope: ActorKind = scopeValue === "tenant" ? "tenant" : "staff";
  const roleId = textOrNull(formData.get("roleId"));
  const result = await savePortalRole({
    roleId: roleId ?? undefined,
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
    scope,
    permissions: formData.getAll("permissions").filter((item): item is string => typeof item === "string"),
  });
  if (!result.ok) return { message: result.message };
  return { ok: true, message: roleId ? "Role updated." : "Role created." };
}

export async function deleteRoleAction(formData: FormData): Promise<void> {
  const result = await deletePortalRole(String(formData.get("roleId") ?? ""));
  if (!result.ok) throw new Error(result.message);
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
