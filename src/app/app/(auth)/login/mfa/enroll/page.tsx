import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth/auth-frame";
import { mfaGate } from "@/lib/auth/access";
import { APP_HOME, LOGIN_END_PATH, LOGIN_PATH, MFA_CHALLENGE_PATH } from "@/lib/paths";
import { loadActor, verifiedFactorCount, verifiedSession } from "@/lib/auth/session";
import { getDataSource } from "@/lib/env";
import { EnrollForm } from "./enroll-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set up authenticator",
};

export default async function EnrollPage() {
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
  if (step === "challenge") redirect(MFA_CHALLENGE_PATH);

  return (
    <AuthFrame
      title="Set up an authenticator"
      description="CML staff need an authenticator app before the license book opens. Pharmacy users are only sent here after they choose to enroll."
    >
      <EnrollForm />
    </AuthFrame>
  );
}
