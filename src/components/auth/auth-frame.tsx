import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/portal/brand-mark";

export function AuthFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-12">
      <BrandMark className="pointer-events-none absolute -top-6 right-[-2rem] size-56 text-primary/[0.08] sm:right-10" />
      <div className="relative w-full max-w-md animate-in fade-in duration-500">
        <Link href="/login" className="group mb-8 flex items-center gap-2.5 rounded-lg">
          <BrandMark className="size-7 text-primary transition-transform duration-200 group-hover:scale-105" />
          <span>
            <span className="block text-[15px] leading-none font-bold tracking-tight">CML</span>
            <span className="mt-1 block text-xs text-muted-foreground">Client Licensing</span>
          </span>
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{title}</h1>
        <span className="mt-3 block h-1 w-12 rounded-full bg-primary" aria-hidden />
        <p className="mt-3 text-sm leading-6 text-pretty text-muted-foreground">{description}</p>
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[0_12px_40px_-24px_oklch(0.4_0.08_155/0.45)] sm:p-6">
          {children}
        </div>
      </div>
    </main>
  );
}
