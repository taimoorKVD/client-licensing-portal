import { cn } from "@/lib/utils";
import {
  STATUS_LABEL,
  displayStatus,
  type DisplayStatus,
  type License,
} from "@/lib/domain";

const tones: Record<DisplayStatus, string> = {
  active:
    "border-[oklch(0.72_0.12_152)] bg-[oklch(0.97_0.03_155)] text-[oklch(0.4_0.12_152)]",
  expiring:
    "border-[oklch(0.75_0.12_70)] bg-[oklch(0.98_0.03_85)] text-[oklch(0.48_0.12_60)]",
  expired:
    "border-[oklch(0.72_0.14_25)] bg-[oklch(0.98_0.02_25)] text-[oklch(0.5_0.16_25)]",
  pending:
    "border-[oklch(0.78_0.03_255)] bg-[oklch(0.97_0.012_250)] text-[oklch(0.4_0.05_258)]",
  suspended:
    "border-[oklch(0.78_0.02_70)] bg-[oklch(0.97_0.008_80)] text-[oklch(0.42_0.03_50)]",
};

export function StatusBadge({
  license,
  status,
  className,
}: {
  license?: Pick<License, "status" | "expiresOn">;
  status?: DisplayStatus;
  className?: string;
}) {
  const resolved = status ?? (license ? displayStatus(license) : "pending");
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-semibold tracking-wide whitespace-nowrap",
        tones[resolved],
        className,
      )}
    >
      {STATUS_LABEL[resolved]}
    </span>
  );
}
