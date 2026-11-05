import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { mfaGate } from "@/lib/auth/access";
import { loadActor, verifiedFactorCount, verifiedSession } from "@/lib/auth/session";
import { ChallengeForm } from "./challenge-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authenticator",
};

export default async function ChallengePage() {
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
  if (step === "enroll") redirect("/login/mfa/enroll");

  return (
    <AuthFrame
      title="Enter your authenticator code"
      description="This sign-in is not finished until the code from your authenticator app is accepted."
    >
      <ChallengeForm />
    </AuthFrame>
  );
}
