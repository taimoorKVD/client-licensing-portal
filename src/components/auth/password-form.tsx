"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Password</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose a new password with at least 12 characters, mixed case, and a digit.
        </p>
      </header>
      <form action={action} className="grid gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required />
        </div>
        {state?.message ? <p className="text-sm text-muted-foreground">{state.message}</p> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update password"}
        </Button>
      </form>
    </div>
  );
}
