import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PasswordForm } from "@/components/auth/password-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Password",
};

export default function AccountPage() {
  if (!isSupabaseConfigured()) redirect("/");
  return <PasswordForm />;
}
