"use client";

import { BrandMark } from "@/components/portal/brand-mark";
import { Button } from "@/components/ui/button";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg">
      <BrandMark className="size-8 text-primary" />
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">The page did not finish loading</h1>
      <span className="mt-3 block h-1 w-12 rounded-full bg-primary" aria-hidden />
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Try the view again. If you were signed in, your session is unchanged.
      </p>
      <Button className="mt-5" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
