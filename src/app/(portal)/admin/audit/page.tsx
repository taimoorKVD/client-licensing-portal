import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadAuditEvents } from "@/lib/auth/directory";
import { isSupabaseConfigured } from "@/lib/env";
import { requirePortalSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Audit",
};

export default async function AuditPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const session = await requirePortalSession();
  if (!session.permissions.includes("audit.read")) {
    return (
      <div>
        <h1 className="text-3xl font-semibold">Audit</h1>
        <p className="mt-2 text-sm text-muted-foreground">You cannot view the audit trail.</p>
      </div>
    );
  }
  const events = await loadAuditEvents();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">Record</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Audit</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Append-only notes for directory and book changes. Passwords and authenticator secrets are not stored here.
        </p>
      </header>
      <ol className="grid gap-3">
        {events.length === 0 ? (
          <li className="rounded-2xl border border-dashed px-4 py-8 text-sm text-muted-foreground">
            No audit events yet.
          </li>
        ) : (
          events.map((event) => (
            <li key={event.id} className="rounded-2xl border border-border bg-card px-4 py-3">
              <p className="text-sm font-semibold">{event.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(event.occurredAt.slice(0, 10))} · {event.action}
              </p>
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
