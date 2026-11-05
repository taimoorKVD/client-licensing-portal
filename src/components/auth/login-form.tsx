"use client";

import { useActionState } from "react";
import { signIn } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/auth/types";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(signIn, null);
  const message = state?.message ?? noticeText(notice);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function noticeText(notice?: string): string | null {
  if (notice === "disabled") return "This account is disabled.";
  if (notice === "unprovisioned") return "This account is not on the CML directory.";
  return null;
}
