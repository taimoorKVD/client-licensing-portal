import type { ReactNode } from "react";
import { BrandMark } from "@/components/portal/brand-mark";
import { cn } from "@/lib/utils";

export function BrandLoader({
  label = "Loading the book",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("brand-motion flex items-center", compact ? "gap-3" : "flex-col gap-3 text-center")}
    >
      <span className={cn("relative grid place-items-center", compact ? "size-11" : "size-16")} aria-hidden>
        <span className="absolute inset-0 rounded-full border border-primary/15" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary/30 [animation-duration:2.4s]" />
        <span className="absolute inset-1.5 rounded-full bg-primary/10 animate-brand-pulse" />
        <BrandMark
          className={cn(
            "relative text-primary animate-brand-spin",
            compact ? "size-5" : "size-7",
          )}
        />
      </span>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

export function PendingLabel({
  pending,
  idle,
  busy,
}: {
  pending: boolean;
  idle: ReactNode;
  busy: ReactNode;
}) {
  if (!pending) return idle;
  return (
    <span className="brand-motion inline-flex items-center gap-2">
      <BrandMark className="size-3.5 animate-brand-spin" />
      {busy}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "brand-motion block animate-skeleton rounded-lg bg-[linear-gradient(90deg,var(--muted)_0%,oklch(0.945_0.02_155)_45%,var(--muted)_100%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

export function RouteLoading({
  label = "Loading the book",
  variant = "table",
}: {
  label?: string;
  variant?: "overview" | "table" | "cards" | "detail";
}) {
  return (
    <div className="flex animate-in flex-col gap-6 fade-in duration-300" aria-busy="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <BrandLoader label={label} compact />
          <div className="grid min-w-0 gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-40 sm:w-56" />
            <Skeleton className="h-3.5 w-52 max-w-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      {variant === "overview" ? <OverviewSkeleton /> : null}
      {variant === "table" ? <TableSkeleton /> : null}
      {variant === "cards" ? <CardSkeleton /> : null}
      {variant === "detail" ? <DetailSkeleton /> : null}
    </div>
  );
}

export function AuthLoading({ label = "Opening sign-in" }: { label?: string }) {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <BrandMark className="pointer-events-none absolute -top-4 right-[-1.5rem] size-48 text-primary/10 sm:right-8" />
      <div className="relative flex w-full max-w-md animate-in flex-col items-center gap-6 fade-in duration-300">
        <div className="flex items-center gap-2.5 self-start">
          <BrandMark className="size-7 text-primary" />
          <span>
            <span className="block text-[15px] leading-none font-bold tracking-tight">CML</span>
            <span className="mt-1 block text-xs text-muted-foreground">Client Licensing</span>
          </span>
        </div>
        <BrandLoader label={label} />
        <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-[0_12px_40px_-24px_oklch(0.4_0.08_155/0.45)]">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-10 w-full" />
          <Skeleton className="mt-4 h-3 w-20" />
          <Skeleton className="mt-2 h-10 w-full" />
          <Skeleton className="mt-5 h-10 w-full" />
        </div>
      </div>
    </main>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)]">
        <div className="grid grid-cols-5 gap-3 border-b bg-muted/60 px-4 py-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-3 w-14" />
          ))}
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div
            key={row}
            className={cn("grid grid-cols-5 gap-3 px-4 py-3.5", row % 2 === 1 && "bg-muted/40")}
          >
            {Array.from({ length: 5 }, (_, column) => (
              <Skeleton key={column} className={cn("h-4", column === 0 ? "w-28" : "w-16")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-2xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-9 w-16" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <Skeleton className="h-5 w-36" />
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="grid gap-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-56" />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
      <Skeleton className="h-56 w-full" />
    </div>
  );
}
