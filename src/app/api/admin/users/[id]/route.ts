import { NextResponse } from "next/server";
import { assignPortalRole, deletePortalUser, setPortalUserDisabled } from "@/lib/auth/admin-service";
import { assertSameOrigin, resultResponse } from "@/lib/auth/http";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Send a JSON change." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  if (typeof record.roleId === "string") {
    return resultResponse(await assignPortalRole(id, record.roleId));
  }
  if (typeof record.disabled === "boolean") {
    return resultResponse(await setPortalUserDisabled(id, record.disabled));
  }
  return NextResponse.json({ error: "Send a role or a disabled flag." }, { status: 400 });
}

export async function DELETE(request: Request, context: Context) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const { id } = await context.params;
  return resultResponse(await deletePortalUser(id));
}
