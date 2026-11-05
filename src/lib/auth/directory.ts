import type { AccessScope, Permission } from "@/lib/auth/access";

export type ManagedUser = {
  userId: string;
  email: string;
  displayName: string;
  kind: "staff" | "tenant";
  roleId: string;
  roleSlug: string;
  roleName: string;
  organizationId: string | null;
  organizationName: string | null;
  protected: boolean;
  disabled: boolean;
};

export type ManagedRole = {
  id: string;
  scope: AccessScope;
  slug: string;
  name: string;
  description: string;
  system: boolean;
  protected: boolean;
  permissions: Permission[];
};

export type OrganizationOption = {
  id: string;
  name: string;
};
