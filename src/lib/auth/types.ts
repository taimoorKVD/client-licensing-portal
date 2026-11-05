import type { ActorKind } from "@/lib/auth/catalog";
import type { Assurance } from "@/lib/auth/policy";

export type PortalSession = {
  provisioned: boolean;
  userId: string;
  email: string;
  displayName: string;
  actorKind: ActorKind;
  roleId: string | null;
  roleKey: string | null;
  roleName: string | null;
  permissions: string[];
  organizationIds: string[];
  protectedAdmin: boolean;
  disabled: boolean;
  aal: Assurance;
  label: string;
  detail: string;
};

export type ActionState = { message: string; ok?: boolean } | null;

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };
