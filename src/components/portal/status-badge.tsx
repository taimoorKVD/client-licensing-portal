import { cn } from "@/lib/utils";
import {
  STATUS_LABEL,
  displayStatus,
  type DisplayStatus,
  type License,
} from "@/lib/domain";

const tones: Record<DisplayStatus, string> = {
  active: "bg-[oklch(0.93_0.045_165)] text-[oklch(0.32_0.06_165)]",
  expiring: "bg-[oklch(0.95_0.05_85)] text-[oklch(0.4_0.08_70)]",
  expired: "bg-[oklch(0.94_0.04_30)] text-[oklch(0.42_0.12_32)]",
  pending: "bg-[oklch(0.94_0.025_250)] text-[oklch(0.38_0.05_255)]",
  suspended: "bg-[oklch(0.93_0.012_70)] text-[oklch(0.4_0.03_50)]",
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
        "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap",
        tones[resolved],
        className,
      )}
    >
      {STATUS_LABEL[resolved]}
    </span>
  );
}
