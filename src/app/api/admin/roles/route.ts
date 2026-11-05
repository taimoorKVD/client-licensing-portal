import { NextResponse } from "next/server";
import { savePortalRole } from "@/lib/auth/admin-service";
import { loadRoles } from "@/lib/auth/directory";
import { assertSameOrigin, resultResponse } from "@/lib/auth/http";
import { readSession } from "@/lib/auth/session";
import type { ActorKind } from "@/lib/auth/catalog";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!session.permissions.includes("roles.read") && !session.permissions.includes("roles.manage")) {
    return NextResponse.json({ error: "You cannot view roles." }, { status: 403 });
  }
  return NextResponse.json({ roles: await loadRoles() });
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Send a JSON role." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  const scope = record.scope === "staff" || record.scope === "tenant" ? record.scope : null;
  if (!scope) return NextResponse.json({ error: "Choose a staff or pharmacy scope." }, { status: 400 });
  const permissions = Array.isArray(record.permissions)
    ? record.permissions.filter((item): item is string => typeof item === "string")
    : [];
  return resultResponse(
    await savePortalRole({
      name: String(record.name ?? ""),
      description: String(record.description ?? ""),
      scope: scope as ActorKind,
      permissions,
    }),
  );
}
