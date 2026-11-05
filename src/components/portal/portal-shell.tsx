"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import {
  Building2,
  FileSpreadsheet,
  LayoutDashboard,
  MapPin,
  Menu,
  ScrollText,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PERSONAS, type PersonaId } from "@/lib/domain";
import type { DataSourceMode } from "@/lib/env";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const NAV = [
  { href: "/", label: "Overview", shortLabel: "Overview", icon: LayoutDashboard, admin: false },
  { href: "/organizations", label: "Organizations", shortLabel: "Your pharmacy", icon: Building2, admin: false },
  { href: "/locations", label: "Locations", shortLabel: "Your locations", icon: MapPin, admin: false },
  { href: "/licenses", label: "Licenses", shortLabel: "Your licenses", icon: ScrollText, admin: false },
  { href: "/import", label: "Import roster", shortLabel: "Import roster", icon: FileSpreadsheet, admin: true },
] as const;

export function PortalShell({
  source,
  children,
}: {
  source: { mode: DataSourceMode; detail: string };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-svh bg-[oklch(0.972_0.008_85)] text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17.5rem] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarBody onNavigate={() => setOpen(false)} />
      </aside>

      <div className="md:pl-[17.5rem]">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur md:hidden">
          <Brand />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={<Button variant="outline" size="icon" aria-label="Open navigation" />}
            >
              <Menu />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[18rem] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
          <p className="text-xs leading-5 text-muted-foreground">
            <span className="font-medium text-foreground">
              {source.mode === "demo" ? "Demo book" : "Supabase"}
            </span>
            {" · "}
            {source.detail}
          </p>
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-5 py-5">
        <Brand />
      </div>
      <Suspense fallback={<nav className="flex-1 px-3 py-4" aria-hidden />}>
        <SideNav onNavigate={onNavigate} />
      </Suspense>
      <PersonaPanel />
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-lg bg-sidebar-primary font-heading text-sm font-semibold text-sidebar-primary-foreground">
        CML
      </span>
      <span>
        <span className="block font-heading text-base leading-none text-sidebar-foreground">
          Client Licensing
        </span>
        <span className="mt-1 block text-xs text-sidebar-foreground/65">Pharmacy book</span>
      </span>
    </Link>
  );
}

function SideNav({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { isAdmin } = usePortal();
  const items = NAV.filter((item) => (item.admin ? isAdmin : true));

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4" aria-label="Primary">
      {items.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
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

function PersonaPanel() {
  const { persona, setPersona, resetDemo } = usePortal();
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-sidebar-border px-4 py-4">
      <p className="px-1 text-[0.65rem] font-medium tracking-[0.16em] text-sidebar-foreground/55 uppercase">
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
                "rounded-lg px-2.5 py-2 text-left transition-colors",
                selected
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60",
              )}
            >
              <span className="block text-sm">{item.label}</span>
              <span className="block text-xs text-sidebar-foreground/60">{item.detail}</span>
            </button>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          className="mt-3 w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-sidebar-foreground/70 underline-offset-4 hover:text-sidebar-foreground hover:underline"
        >
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
