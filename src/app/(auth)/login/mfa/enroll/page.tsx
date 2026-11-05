import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { mfaGate } from "@/lib/auth/access";
import { loadActor, verifiedFactorCount, verifiedSession } from "@/lib/auth/session";
import { EnrollForm } from "./enroll-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up authenticator",
};

export default async function EnrollPage() {
  await connection();
  const session = await verifiedSession();
  if (!session) redirect("/login");
  const actor = await loadActor(session.supabase, session.userId);
  if (!actor) redirect("/login/end?reason=unprovisioned");
  const factors = await verifiedFactorCount(session.supabase);
  const step = mfaGate({
    kind: actor.kind,
    verifiedFactorCount: factors,
    currentLevel: session.aal,
  });
  if (step === "ready") redirect("/");
  if (step === "challenge") redirect("/login/mfa/challenge");

  return (
    <AuthFrame
      title="Set up an authenticator"
      description="CML staff need an authenticator app before the license book opens. Pharmacy users are only sent here after they choose to enroll."
    >
      <EnrollForm />
    </AuthFrame>
  );
}
