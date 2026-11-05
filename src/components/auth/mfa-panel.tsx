"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Mode = "choose" | "enroll" | "challenge";

export function MfaPanel({ email }: { email: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function startEnrollment() {
    setError("");
    setPending(true);
    const supabase = createClient();
    const listed = await supabase.auth.mfa.listFactors();
    if (listed.error) {
      setPending(false);
      setError(listed.error.message);
      return;
    }
    for (const factor of listed.data.totp) {
      if (factor.status !== "verified") {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
    }
    const verified = listed.data.totp.find((factor) => factor.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      setMode("challenge");
      setPending(false);
      return;
    }
    const enrolled = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "CML Client Licensing",
      issuer: "CML",
    });
    setPending(false);
    if (enrolled.error) {
      setError(enrolled.error.message);
      return;
    }
    setFactorId(enrolled.data.id);
    setSecret(enrolled.data.totp.secret);
    setQr(qrSource(enrolled.data.totp.qr_code));
    setMode("enroll");
  }

  async function startChallenge() {
    setError("");
    setPending(true);
    const supabase = createClient();
    const listed = await supabase.auth.mfa.listFactors();
    setPending(false);
    if (listed.error) {
      setError(listed.error.message);
      return;
    }
    const verified = listed.data.totp.find((factor) => factor.status === "verified");
    if (!verified) {
      setError("This account does not have an authenticator yet.");
      return;
    }
    setFactorId(verified.id);
    setMode("challenge");
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const supabase = createClient();
    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error) {
      setPending(false);
      setError(challenge.error.message);
      return;
    }
    const verified = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    setPending(false);
    if (verified.error) {
      setError(verified.error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      <p className="text-sm text-muted-foreground">
        Signed in as <span className="font-medium text-foreground">{email}</span>
      </p>
      {mode === "choose" ? (
        <div className="grid gap-3">
          <p className="text-sm leading-6 text-muted-foreground">
            Staff accounts need an authenticator app before the directory opens. The first sign-in has no factor yet: Supabase only marks one verified after you confirm a code. Later sign-ins stop at the code from the app you already enrolled.
          </p>
          <Button type="button" onClick={startEnrollment} disabled={pending}>
            Set up authenticator
          </Button>
          <Button type="button" variant="outline" onClick={startChallenge} disabled={pending}>
            I already have a code
          </Button>
        </div>
      ) : null}
      {mode === "enroll" ? (
        <form onSubmit={verify} className="grid gap-4">
          <Image src={qr} alt="Authenticator QR code" width={176} height={176} unoptimized className="h-44 w-44 rounded-lg border bg-white p-2" />
          <p className="text-xs leading-5 text-muted-foreground">
            If you cannot scan the code, enter this secret manually:{" "}
            <span className="font-mono text-foreground">{secret}</span>
          </p>
          <CodeField code={code} onChange={setCode} />
          <Button type="submit" disabled={pending || code.trim().length < 6}>
            Confirm and continue
          </Button>
        </form>
      ) : null}
      {mode === "challenge" ? (
        <form onSubmit={verify} className="grid gap-4">
          <p className="text-sm leading-6 text-muted-foreground">
            Enter the 6-digit code from your authenticator app.
          </p>
          <CodeField code={code} onChange={setCode} />
          <Button type="submit" disabled={pending || code.trim().length < 6}>
            Verify
          </Button>
        </form>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <form action={signOut}>
        <Button type="submit" variant="ghost">
          Sign out
        </Button>
      </form>
    </div>
  );
}

function CodeField({ code, onChange }: { code: string; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor="code">Authenticator code</Label>
      <Input
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function qrSource(qr: string): string {
  if (qr.startsWith("data:")) return qr;
  return `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`;
}
