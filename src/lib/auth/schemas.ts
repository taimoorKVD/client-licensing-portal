import { z } from "zod";
import { ACCESS_SCOPES, ALL_PERMISSIONS, slugifyRoleName } from "@/lib/auth/access";
import { LICENSE_STATUSES } from "@/lib/domain";

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(200)
  .refine((value) => /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value), {
    message: "Use an uppercase letter, a lowercase letter, and a digit.",
  });

export const emailSchema = z
  .string()
  .trim()
  .max(320)
  .pipe(z.email("Enter a valid email address."))
  .transform((value) => value.toLowerCase());

export const createUserSchema = z
  .object({
    email: emailSchema,
    displayName: z.string().trim().min(1, "Enter a name.").max(120),
    password: passwordSchema,
    actorKind: z.enum(["staff", "tenant"]),
    roleId: z.uuid("Choose a role."),
    organizationId: z.uuid("Choose a pharmacy.").optional(),
  })
  .superRefine((value, context) => {
    if (value.actorKind === "tenant" && !value.organizationId) {
      context.addIssue({
        code: "custom",
        path: ["organizationId"],
        message: "A pharmacy user must belong to one pharmacy.",
      });
    }
    if (value.actorKind === "staff" && value.organizationId) {
      context.addIssue({
        code: "custom",
        path: ["organizationId"],
        message: "CML staff are not members of a pharmacy.",
      });
    }
  });

export const assignRoleSchema = z.object({
  userId: z.uuid(),
  roleId: z.uuid(),
  organizationId: z.uuid().optional(),
});

export const userIdSchema = z.object({
  userId: z.uuid(),
});

export const roleDraftSchema = z.object({
  name: z.string().trim().min(2, "Name the role.").max(80),
  description: z.string().trim().max(400).default(""),
  scope: z.enum(ACCESS_SCOPES),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).min(1, "Choose at least one permission."),
});

export const roleUpdateSchema = roleDraftSchema.extend({
  roleId: z.uuid(),
});

export function roleSlugFromName(name: string): string {
  return slugifyRoleName(name);
}

export const licenseStatusUpdateSchema = z.object({
  id: z.uuid(),
  status: z.enum(LICENSE_STATUSES),
});

export const mappedLicenseSchema = z.object({
  organizationName: z.string().trim().min(1).max(200),
  locationName: z.string().trim().min(1).max(200),
  addressLine1: z.string().trim().max(200),
  city: z.string().trim().max(120),
  state: z.string().trim().regex(/^[A-Z]{2}$/),
  postalCode: z.string().trim().max(20),
  licenseNumber: z.string().trim().min(1).max(80),
  licenseType: z.string().trim().min(1).max(120),
  issuingAuthority: z.string().trim().min(1).max(160),
  status: z.enum(LICENSE_STATUSES),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  deaNumber: z.string().trim().max(40),
  ncpdp: z.string().trim().max(40),
  contactEmail: z.string().trim().max(320),
  notes: z.string().trim().max(2000),
});

export const importRosterSchema = z.array(mappedLicenseSchema).min(1).max(500);
