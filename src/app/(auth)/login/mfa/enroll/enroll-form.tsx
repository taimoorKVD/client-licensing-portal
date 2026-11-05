"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function EnrollForm() {
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "CML authenticator",
        });
        if (cancelled) return;
        if (enrollError || !data || data.type !== "totp") {
          setError(enrollError?.message ?? "The authenticator could not be started.");
          return;
        }
        setFactorId(data.id);
        setSecret(data.totp.secret);
        const image = data.totp.qr_code.startsWith("data:")
          ? data.totp.qr_code
          : `data:image/svg+xml;utf-8,${encodeURIComponent(data.totp.qr_code)}`;
        setQr(image);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "The authenticator could not be started.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error || !challenge.data) {
        setPending(false);
        setError(challenge.error?.message ?? "The code could not be checked.");
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
      router.push("/");
      router.refresh();
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "The code could not be checked.");
    }
  }

  return (
    <form onSubmit={verify} className="grid gap-4">
      <p className="text-sm leading-6 text-muted-foreground">
        Scan the code with an authenticator app, then enter the 6-digit code. Staff cannot open the book until this
        step succeeds. The first sign-in is enrollment because Supabase does not require a second factor until one is
        verified.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {qr ? (
        // The SVG is a data URL from the signed-in user's own enrollment call.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="Authenticator QR code" className="mx-auto size-48 rounded-lg bg-white p-2" />
      ) : (
        <p className="text-sm text-muted-foreground">Preparing the authenticator…</p>
      )}
      {secret ? (
        <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
          <span className="block font-sans text-[0.65rem] tracking-wide text-muted-foreground uppercase">
            Manual key
          </span>
          {secret}
        </p>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="code">Authenticator code</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          className="h-10"
        />
      </div>
      <Button type="submit" disabled={pending || !factorId} className="h-10">
        {pending ? "Checking…" : "Enable authenticator"}
      </Button>
    </form>
  );
}
