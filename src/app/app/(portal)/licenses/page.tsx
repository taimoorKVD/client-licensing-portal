import { Suspense } from "react";
import type { Metadata } from "next";
import { LicensesView } from "@/components/views/licenses-view";

export const metadata: Metadata = {
  title: "Licenses",
};

export default function LicensesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading the license book…</p>}>
      <LicensesView />
    </Suspense>
  );
}
