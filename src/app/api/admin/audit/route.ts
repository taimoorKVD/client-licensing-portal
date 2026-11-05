import { NextResponse } from "next/server";
import { loadAuditEvents } from "@/lib/auth/directory";
import { readSession } from "@/lib/auth/session";

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!session.permissions.includes("audit.read")) {
    return NextResponse.json({ error: "You cannot view the audit trail." }, { status: 403 });
  }
  return NextResponse.json({ events: await loadAuditEvents() });
}
