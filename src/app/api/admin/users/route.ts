import { NextResponse } from "next/server";
import { createPortalUser } from "@/lib/auth/admin-service";
import { loadDirectory } from "@/lib/auth/directory";
import { assertSameOrigin, resultResponse } from "@/lib/auth/http";
import { readSession } from "@/lib/auth/session";
import type { ActorKind } from "@/lib/auth/catalog";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canReadPeople(session.permissions)) {
    return NextResponse.json({ error: "You cannot view the directory." }, { status: 403 });
  }
  const people = await loadDirectory();
  return NextResponse.json({ people });
}

export async function POST(request: Request) {
  const origin = assertSameOrigin(request);
  if (origin) return origin;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Send a JSON account." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  const actorKind = record.actorKind === "staff" || record.actorKind === "tenant" ? record.actorKind : null;
  if (!actorKind) return NextResponse.json({ error: "Choose staff or pharmacy." }, { status: 400 });
  return resultResponse(
    await createPortalUser({
      email: String(record.email ?? ""),
      displayName: String(record.displayName ?? ""),
      password: String(record.password ?? ""),
      actorKind: actorKind as ActorKind,
      roleId: String(record.roleId ?? ""),
      organizationId: typeof record.organizationId === "string" ? record.organizationId : null,
    }),
  );
}

function canReadPeople(permissions: string[]): boolean {
  return (
    permissions.includes("users.read") ||
    permissions.includes("users.manage") ||
    permissions.includes("org.users.read") ||
    permissions.includes("org.users.manage")
  );
}
