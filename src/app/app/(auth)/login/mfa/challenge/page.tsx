import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { mfaGate } from "@/lib/auth/access";
import { APP_HOME, LOGIN_END_PATH, LOGIN_PATH, MFA_ENROLL_PATH } from "@/lib/paths";
import { loadActor, verifiedFactorCount, verifiedSession } from "@/lib/auth/session";
import { getDataSource } from "@/lib/env";
import { ChallengeForm } from "./challenge-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authenticator",
};

export default async function ChallengePage() {
  await connection();
  const source = getDataSource();
  if (source === "demo") redirect(APP_HOME);
  if (source !== "supabase") redirect(LOGIN_PATH);
  const session = await verifiedSession();
  if (!session) redirect(LOGIN_PATH);
  const actor = await loadActor(session.supabase, session.userId);
  if (!actor) redirect(`${LOGIN_END_PATH}?reason=unprovisioned`);
  const factors = await verifiedFactorCount(session.supabase);
  const step = mfaGate({
    kind: actor.kind,
    verifiedFactorCount: factors,
    currentLevel: session.aal,
  });
  if (step === "ready") redirect(APP_HOME);
  if (step === "enroll") redirect(MFA_ENROLL_PATH);

  return (
    <AuthFrame
      title="Enter your authenticator code"
      description="This sign-in is not finished until the code from your authenticator app is accepted."
    >
      <ChallengeForm />
    </AuthFrame>
  );
}
