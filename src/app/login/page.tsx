import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/");
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-8 px-4 py-12">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">CML</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Client Licensing</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          CML provisions every account. There is no public registration. Pharmacy users see only their own organization. Staff sign-in continues to an authenticator before the directory opens.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_oklch(0.3_0.03_258/0.04)]">
        <LoginForm notice={params.notice} />
      </div>
    </main>
  );
}
