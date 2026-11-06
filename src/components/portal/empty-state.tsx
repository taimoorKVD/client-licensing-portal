"use client";

import {
  Building2,
  FileText,
  History,
  KeyRound,
  LockKeyhole,
  MapPin,
  ScrollText,
  StickyNote,
  Unplug,
  Users,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type EmptyIcon =
  | "building"
  | "file"
  | "history"
  | "key"
  | "lock"
  | "map"
  | "note"
  | "scroll"
  | "unplug"
  | "users";

function NamedIcon({ name }: { name: EmptyIcon }) {
  const className = "size-5";
  switch (name) {
    case "building":
      return <Building2 className={className} aria-hidden />;
    case "file":
      return <FileText className={className} aria-hidden />;
    case "history":
      return <History className={className} aria-hidden />;
    case "key":
      return <KeyRound className={className} aria-hidden />;
    case "lock":
      return <LockKeyhole className={className} aria-hidden />;
    case "map":
      return <MapPin className={className} aria-hidden />;
    case "note":
      return <StickyNote className={className} aria-hidden />;
    case "scroll":
      return <ScrollText className={className} aria-hidden />;
    case "unplug":
      return <Unplug className={className} aria-hidden />;
    case "users":
      return <Users className={className} aria-hidden />;
  }
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  framed = false,
  className,
}: {
  icon: EmptyIcon;
  title: string;
  description: string;
  action?: ReactNode;
  framed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center px-6 py-12 text-center",
        framed && "rounded-2xl border border-dashed border-primary/30 bg-card",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-accent text-primary">
        <NamedIcon name={icon} />
      </span>
      <p className="mt-4 text-base font-semibold tracking-tight text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function TableEmpty({
  colSpan,
  ...props
}: {
  colSpan: number;
} & Omit<ComponentProps<typeof EmptyState>, "framed">) {
  return (
    <TableRow className="bg-transparent even:bg-transparent hover:bg-transparent">
      <TableCell colSpan={colSpan} className="p-0 whitespace-normal">
        <EmptyState {...props} />
      </TableCell>
    </TableRow>
  );
}
