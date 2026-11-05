import { Suspense } from "react";
import type { Metadata } from "next";
import { OrganizationDetailView } from "@/components/views/organization-detail-view";
import { seedSnapshot } from "@/lib/seed";

export const metadata: Metadata = {
  title: "Organization",
};

export function generateStaticParams() {
  return seedSnapshot.organizations.map((organization) => ({ id: organization.id }));
}

export default function OrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Opening pharmacy…</p>}>
      <OrganizationLoader params={params} />
    </Suspense>
  );
}

async function OrganizationLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrganizationDetailView id={id} />;
}
