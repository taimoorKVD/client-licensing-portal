import type { Metadata } from "next";
import { PageHeader } from "@/components/portal/page-header";
import { hasPermission } from "@/lib/auth/access";
import { requirePortalSession } from "@/lib/auth/session";
import { getDataSource } from "@/lib/env";

export const metadata: Metadata = {
  title: "Audit",
};

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export default async function AuditPage() {
  if (getDataSource() !== "supabase") {
    return <p className="text-sm text-muted-foreground">The audit trail is available when Supabase Auth is configured.</p>;
  }
  const session = await requirePortalSession();
  if (!hasPermission(session.actor, "staff.audit.read")) {
    return <p className="text-sm text-muted-foreground">You do not have access to the audit trail.</p>;
  }

  const { data, error } = await session.supabase
    .from("audit_events")
    .select("id, actor_id, action, entity_type, entity_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const rows = (data ?? []) as AuditRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Audit"
        title={"What changed,\nand who did it."}
        description="Account passwords, authenticator secrets, and the service role key are not written here."
      />
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Record</th>
              <th className="px-4 py-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No audited changes yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">{row.action}</td>
                  <td className="px-4 py-3">
                    {row.entity_type}
                    <span className="mt-1 block text-xs text-muted-foreground">{row.entity_id}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{summarize(row.metadata)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function summarize(metadata: Record<string, unknown> | null): string {
  if (!metadata) return "";
  return Object.entries(metadata)
    .filter(([key]) => !["password", "secret", "access_token", "refresh_token"].includes(key))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ");
}
