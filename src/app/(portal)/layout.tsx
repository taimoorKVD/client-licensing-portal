import type { ReactNode } from "react";
import { PortalProvider } from "@/components/portal/portal-provider";
import { PortalShell } from "@/components/portal/portal-shell";
import { loadPortalSnapshot } from "@/lib/data/load-portal";
import { describeDataSource, isSupabaseConfigured } from "@/lib/env";
import { requirePortalSession } from "@/lib/auth/session";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const source = describeDataSource();

  if (!isSupabaseConfigured()) {
    return (
      <PortalProvider mode="demo">
        <PortalShell source={source}>{children}</PortalShell>
      </PortalProvider>
    );
  }

  const session = await requirePortalSession();
  const snapshot = await loadPortalSnapshot();

  return (
    <PortalProvider mode="live" session={session} snapshot={snapshot}>
      <PortalShell source={source}>{children}</PortalShell>
    </PortalProvider>
  );
}
