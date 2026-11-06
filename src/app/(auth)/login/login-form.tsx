"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/lib/auth/actions";
import { InlineNotice } from "@/components/portal/inline-notice";
import { PendingLabel } from "@/components/portal/brand-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: SignInState = { error: "" };

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="grid gap-4">
      {notice ? <InlineNotice>{notice}</InlineNotice> : null}
      {state.error ? <InlineNotice tone="error">{state.error}</InlineNotice> : null}
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required className="h-10" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-10"
        />
      </div>
      <Button type="submit" disabled={pending} className="h-10">
        <PendingLabel pending={pending} idle="Sign in" busy="Signing in…" />
      </Button>
      <p className="text-xs leading-5 text-muted-foreground">
        CML issues every account. This portal has no public registration.
      </p>
    </form>
  );
}
