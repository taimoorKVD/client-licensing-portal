import { connection } from "next/server";
import type { ReactNode } from "react";
import { PortalProvider } from "@/components/portal/portal-provider";
import { PortalShell } from "@/components/portal/portal-shell";
import { requirePortalSession } from "@/lib/auth/session";
import { loadLiveSnapshot } from "@/lib/data/load-snapshot";
import { describeDataSource, getDataSource } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  await connection();
  const mode = getDataSource();
  const source = describeDataSource();

  if (mode === "unconfigured") {
    return (
      <main className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-6 py-16">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">CML</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">The portal is not configured</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Production does not serve the sample book. Set the Supabase URL, publishable key, and server-only secret,
          then start the Node process again. The bootstrap steps are in docs/AUTH.md.
        </p>
      </main>
    );
  }

  if (mode === "demo") {
    return (
      <PortalProvider>
        <PortalShell source={source}>{children}</PortalShell>
      </PortalProvider>
    );
  }

  const session = await requirePortalSession();
  const snapshot = await loadLiveSnapshot(session.supabase);
  return (
    <PortalProvider live={{ actor: session.actor, snapshot }}>
      <PortalShell source={source}>{children}</PortalShell>
    </PortalProvider>
  );
}
