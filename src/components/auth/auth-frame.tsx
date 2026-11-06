import Link from "next/link";
import type { ReactNode } from "react";

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
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="size-7 text-primary" aria-hidden>
            <path fill="currentColor" d="M13 2h6v9h11v6H19v13h-6V17H2v-6h11V2z" />
          </svg>
          <span>
            <span className="block text-[15px] leading-none font-bold tracking-tight">CML</span>
            <span className="mt-1 block text-xs text-muted-foreground">Client Licensing</span>
          </span>
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6 rounded-2xl border border-border bg-card p-5">{children}</div>
      </div>
    </main>
  );
}
