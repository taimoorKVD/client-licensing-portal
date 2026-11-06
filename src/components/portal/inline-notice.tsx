import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  info: "border-border bg-muted/80 text-foreground",
  success: "border-primary/25 bg-accent text-accent-foreground",
} as const;

const icons = {
  error: TriangleAlert,
  info: Info,
  success: CircleCheck,
} as const;

export function InlineNotice({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  const Icon = icons[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm leading-5",
        tones[tone],
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
