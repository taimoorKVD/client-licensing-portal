"use server";

import { redirect } from "next/navigation";
import { portalDestination, verifiedSession } from "@/lib/auth/session";
import { emailSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string };

export async function signIn(_state: SignInState, formData: FormData): Promise<SignInState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email.success || password.length === 0) {
    return { error: "Enter the email and password for an account CML has issued." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password,
  });
  if (error) return { error: "Email or password is incorrect." };

  const session = await verifiedSession();
  if (!session) return { error: "Email or password is incorrect." };
  redirect(await portalDestination(session));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
