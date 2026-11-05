"use client";

import { Button } from "@/components/ui/button";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-lg">
      <h1 className="text-3xl font-medium">The page did not finish loading</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Try the view again. The demo book in this browser is unchanged.
      </p>
      <Button className="mt-5" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
