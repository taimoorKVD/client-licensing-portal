import { Suspense } from "react";
import type { Metadata } from "next";
import { LicenseDetailView } from "@/components/views/license-detail-view";
import { seedSnapshot } from "@/lib/seed";

export const metadata: Metadata = {
  title: "License",
};

export function generateStaticParams() {
  return seedSnapshot.licenses.map((license) => ({ id: license.id }));
}

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
