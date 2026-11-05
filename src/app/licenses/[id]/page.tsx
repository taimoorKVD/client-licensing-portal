import { Suspense } from "react";
import type { Metadata } from "next";
import { LicenseDetailView } from "@/components/views/license-detail-view";

export const metadata: Metadata = {
  title: "License",
};

export default function LicensePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Opening license…</p>}>
      <LicenseLoader params={params} />
    </Suspense>
  );
}

async function LicenseLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LicenseDetailView id={id} />;
}
