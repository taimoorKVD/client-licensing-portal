import { Suspense } from "react";
import type { Metadata } from "next";
import { RouteLoading } from "@/components/portal/brand-loader";
import { LicensesView } from "@/components/views/licenses-view";

export const metadata: Metadata = {
  title: "Licenses",
};

export default function LicensesPage() {
  return (
    <Suspense fallback={<RouteLoading variant="table" label="Loading the license book" />}>
      <LicensesView />
    </Suspense>
  );
}
