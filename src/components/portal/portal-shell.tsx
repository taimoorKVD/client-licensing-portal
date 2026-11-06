"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Building2, Check, FileSpreadsheet, History, KeyRound, MapPin, Menu, ScrollText, LayoutDashboard, Users } from "lucide-react";
import { usePortal } from "@/components/portal/portal-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "@/lib/auth/actions";
import type { Permission } from "@/lib/auth/access";
import { APP_HOME, appPath } from "@/lib/paths";
import { PERSONAS, type PersonaId } from "@/lib/domain";
import type { DataSourceMode } from "@/lib/env";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAV = [
  { href: APP_HOME, label: "Overview", shortLabel: "Overview", icon: LayoutDashboard },
  { href: appPath("/organizations"), label: "Organizations", shortLabel: "Your pharmacy", icon: Building2 },
  { href: appPath("/locations"), label: "Locations", shortLabel: "Your locations", icon: MapPin },
  { href: appPath("/licenses"), label: "Licenses", shortLabel: "Your licenses", icon: ScrollText },
  { href: appPath("/import"), label: "Import roster", shortLabel: "Import roster", icon: FileSpreadsheet, permission: "staff.licenses.import" },
  { href: appPath("/admin/users"), label: "Users", shortLabel: "Users", icon: Users, permission: "staff.users.read", liveOnly: true },
  { href: appPath("/admin/roles"), label: "Roles", shortLabel: "Roles", icon: KeyRound, permission: "staff.roles.manage", liveOnly: true },
  { href: appPath("/admin/audit"), label: "Audit", shortLabel: "Audit", icon: History, permission: "staff.audit.read", liveOnly: true },
] as const;

export function PortalShell({
  source,
  children,
}: {
  source: { mode: DataSourceMode; detail: string };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { persona, mode } = usePortal();

  return (
    <div className="min-h-svh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <SidebarBody onNavigate={() => setOpen(false)} />
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <Brand />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="outline" size="icon" aria-label="Open navigation" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-8 sm:py-8">
          <MedicalCross className="pointer-events-none absolute top-24 -right-2 hidden size-28 text-primary/[0.07] xl:block" />
          <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2">
            <p
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground"
              title={source.detail}
            >
              <Check className="size-3.5" />
              {mode === "demo" ? "Local preview" : "Signed in"}
            </p>
            <p className="text-sm text-muted-foreground">
              Viewing as <span className="font-semibold text-foreground">{persona.label}</span>
            </p>
          </div>
          <div className="relative">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate: () => void }) {
  const { mode } = usePortal();
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-4">
        <Brand />
      </div>
      <Suspense fallback={<nav className="flex-1 px-3 py-2" aria-hidden />}>
        <SideNav onNavigate={onNavigate} />
      </Suspense>
      {mode === "demo" ? <PersonaPanel /> : <AccountPanel />}
    </div>
  );
}

function Brand() {
  return (
    <Link href={APP_HOME} className="group flex items-center gap-2.5 rounded-lg focus-visible:outline-none">
      <MedicalCross className="size-7 text-primary transition-transform group-hover:scale-105" />
      <span>
        <span className="block text-[15px] leading-none font-bold tracking-tight text-foreground">CML</span>
        <span className="mt-1 block text-xs text-muted-foreground">Client Licensing</span>
      </span>
    </Link>
  );
}

function SideNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { isAdmin, mode, can } = usePortal();
  const items = NAV.filter((item) => {
    if ("liveOnly" in item && item.liveOnly && mode !== "live") return false;
    if ("permission" in item && item.permission && !can(item.permission as Permission)) return false;
    return true;
  });

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3" aria-label="Primary">
      {items.map((item) => {
        const active = item.href === APP_HOME ? pathname === APP_HOME : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {isAdmin ? item.label : item.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountPanel() {
  const { persona, actorEmail } = usePortal();
  return (
    <div className="border-t border-sidebar-border px-3 py-4">
      <p className="px-2 text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        Signed in
      </p>
      <p className="mt-2 px-2 text-sm font-medium">{persona.label}</p>
      <p className="px-2 text-xs text-muted-foreground">{actorEmail}</p>
      <form action={signOut} className="mt-3 px-2">
        <Button type="submit" variant="outline" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}

function PersonaPanel() {
  const { persona, setPersona, resetDemo } = usePortal();
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-sidebar-border px-3 py-4">
      <p className="px-2 text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
        Viewing as
      </p>
      <div className="mt-2 grid gap-1" role="group" aria-label="Demo role">
        {PERSONAS.map((item) => {
          const selected = item.id === persona.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setPersona(item.id as PersonaId)}
              className={cn(
                "rounded-xl px-2.5 py-2 text-left transition-colors",
                selected
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="block text-xs text-muted-foreground">{item.detail}</span>
            </button>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger className="mt-2 w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Reset demo book
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset the demo book?</DialogTitle>
            <DialogDescription>
              Imported rows and status edits in this browser will be removed. The sample roster files stay available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => {
                resetDemo();
                setOpen(false);
                toast.success("Demo book restored");
              }}
            >
              Reset book
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MedicalCross({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <path fill="currentColor" d="M13 2h6v9h11v6H19v13h-6V17H2v-6h11V2z" />
    </svg>
  );
}
