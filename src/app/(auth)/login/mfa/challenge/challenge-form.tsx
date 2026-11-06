"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PendingLabel } from "@/components/portal/brand-loader";
import { InlineNotice } from "@/components/portal/inline-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChallengeForm() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const supabase = createClient();
    const factors = await supabase.auth.mfa.listFactors();
    const factor = factors.data?.totp[0];
    if (factors.error || !factor) {
      setPending(false);
      setError(factors.error?.message ?? "No authenticator is enrolled.");
      return;
    }
    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challenge.error || !challenge.data) {
      setPending(false);
      setError(challenge.error?.message ?? "The code could not be checked.");
      return;
    }
    const verified = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    setPending(false);
    if (verified.error) {
      setError(verified.error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={verify} className="grid gap-4">
      {error ? <InlineNotice tone="error">{error}</InlineNotice> : null}
      <div className="grid gap-2">
        <Label htmlFor="code">Authenticator code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onValueChange={setCode}
          required
          className="h-10"
        />
      </div>
      <Button type="submit" disabled={pending} className="h-10">
        <PendingLabel pending={pending} idle="Continue" busy="Checking…" />
      </Button>
    </form>
  );
}
