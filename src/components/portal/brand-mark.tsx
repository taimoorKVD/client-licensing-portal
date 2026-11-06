import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("shrink-0", className)} aria-hidden>
      <path fill="currentColor" d="M13 2h6v9h11v6H19v13h-6V17H2v-6h11V2z" />
    </svg>
  );
}
