import { Suspense } from "react";
import type { Metadata } from "next";
import { RouteLoading } from "@/components/portal/brand-loader";
import { OrganizationDetailView } from "@/components/views/organization-detail-view";

export const metadata: Metadata = {
  title: "Organization",
};

export default function OrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<RouteLoading variant="detail" label="Opening pharmacy" />}>
      <OrganizationLoader params={params} />
    </Suspense>
  );
}

async function OrganizationLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrganizationDetailView id={id} />;
}
