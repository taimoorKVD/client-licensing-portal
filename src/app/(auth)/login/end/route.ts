import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const REASONS = new Set(["unprovisioned", "disabled"]);

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = new URL(request.url).searchParams.get("reason");
  const destination = new URL("/login", request.url);
  if (reason && REASONS.has(reason)) destination.searchParams.set("error", reason);
  return NextResponse.redirect(destination);
}
