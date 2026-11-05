import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaPanel } from "@/components/auth/mfa-panel";
import { isSupabaseConfigured } from "@/lib/env";
import { readSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Authenticator",
};

export default async function MfaPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const session = await readSession();
  if (!session) redirect("/login");
  if (!session.provisioned) redirect("/login?notice=unprovisioned");
  if (session.disabled) redirect("/login?notice=disabled");
  if (session.actorKind !== "staff" || session.aal === "aal2") redirect("/");

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Staff sign-in</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Authenticator required</h1>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <MfaPanel email={session.email} />
      </div>
    </main>
  );
}
