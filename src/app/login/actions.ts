"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeEmail, validateNewPassword } from "@/lib/auth/policy";
import { readSession } from "@/lib/auth/session";
import type { ActionState } from "@/lib/auth/types";

export async function signIn(_state: ActionState, formData: FormData): Promise<ActionState> {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { message: "Enter the email and password from your CML administrator." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { message: "Invalid email or password." };
  }

  const session = await readSession();
  if (!session?.provisioned) {
    await supabase.auth.signOut();
    return { message: "This account is not on the CML directory." };
  }
  if (session.disabled) {
    await supabase.auth.signOut();
    return { message: "This account is disabled." };
  }
  if (session.actorKind === "staff" && session.aal !== "aal2") {
    redirect("/mfa");
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function changePassword(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await readSession();
  if (!session?.provisioned || session.disabled) {
    return { message: "Sign in again before changing the password." };
  }
  if (session.actorKind === "staff" && session.aal !== "aal2") {
    return { message: "Finish authenticator verification before changing the password." };
  }
  const password = String(formData.get("password") ?? "");
  const decision = validateNewPassword(password);
  if (!decision.ok) return { message: decision.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { message: "The password was not changed. Sign in again and retry." };
  }
  return { message: "Password updated." };
}
