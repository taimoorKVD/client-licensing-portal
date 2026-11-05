import { NextResponse } from "next/server";
import { deletePortalRole, savePortalRole } from "@/lib/auth/admin-service";
import { assertSameOrigin, resultResponse } from "@/lib/auth/http";
import type { ActorKind } from "@/lib/auth/catalog";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Send a JSON role." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  const scope = record.scope === "staff" || record.scope === "tenant" ? record.scope : "staff";
  const permissions = Array.isArray(record.permissions)
    ? record.permissions.filter((item): item is string => typeof item === "string")
    : [];
  return resultResponse(
    await savePortalRole({
      roleId: id,
      name: String(record.name ?? ""),
      description: String(record.description ?? ""),
      scope: scope as ActorKind,
      permissions,
    }),
  );
}

export async function DELETE(request: Request, context: Context) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const { id } = await context.params;
  return resultResponse(await deletePortalRole(id));
}
