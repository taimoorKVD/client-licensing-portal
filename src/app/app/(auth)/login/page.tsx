import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { portalDestination, verifiedSession } from "@/lib/auth/session";
import { APP_HOME } from "@/lib/paths";
import { getDataSource } from "@/lib/env";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
};

const NOTICES: Record<string, string> = {
  unprovisioned: "This account is not on the portal. A CML admin has to issue access.",
  disabled: "This account is disabled.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  const source = getDataSource();
  if (source === "demo") {
    redirect(APP_HOME);
  }
  if (source === "supabase") {
    const session = await verifiedSession();
    if (session) redirect(await portalDestination(session));
  }

  const params = await searchParams;
  const notice = params.error ? NOTICES[params.error] : undefined;

  return (
    <AuthFrame
      title="Sign in"
      description={
        source === "unconfigured"
          ? "This server does not have Supabase configured, so the book stays closed."
          : "Use the email and password CML gave you. Staff enroll an authenticator app on the first sign-in."
      }
    >
      {source === "unconfigured" ? (
        <p className="text-sm leading-6 text-muted-foreground">
          Set <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, and the
          server-only <code>SUPABASE_SECRET_KEY</code>, then restart the Node process. See <code>docs/AUTH.md</code>.
        </p>
      ) : (
        <LoginForm notice={notice} />
      )}
    </AuthFrame>
  );
}
