import type { Metadata } from "next";
import { EmptyState, TableEmpty } from "@/components/portal/empty-state";
import { PageHeader } from "@/components/portal/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    return (
      <EmptyState
        framed
        icon="unplug"
        title="Supabase is required"
        description="The audit trail is available when Supabase Auth is configured."
      />
    );
  }
  const session = await requirePortalSession();
  if (!hasPermission(session.actor, "staff.audit.read")) {
    return (
      <EmptyState
        framed
        icon="lock"
        title="Restricted"
        description="You do not have access to the audit trail."
      />
    );
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
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty
                colSpan={4}
                icon="history"
                title="No audited changes yet"
                description="Account, role, and license changes will be listed here. Passwords and secrets are not written to this trail."
              />
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</TableCell>
                  <TableCell className="font-medium">{row.action}</TableCell>
                  <TableCell className="whitespace-normal">
                    {row.entity_type}
                    <span className="mt-1 block text-xs text-muted-foreground">{row.entity_id}</span>
                  </TableCell>
                  <TableCell className="max-w-md whitespace-normal text-muted-foreground">{summarize(row.metadata)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
