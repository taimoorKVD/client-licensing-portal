import { NextResponse } from "next/server";
import { LOGIN_PATH } from "@/lib/paths";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const REASONS = new Set(["unprovisioned", "disabled"]);

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = new URL(request.url).searchParams.get("reason");
  const destination = new URL(LOGIN_PATH, request.url);
  if (reason && REASONS.has(reason)) destination.searchParams.set("error", reason);
  return NextResponse.redirect(destination);
}
