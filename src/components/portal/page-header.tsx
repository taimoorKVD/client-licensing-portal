import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-[0.7rem] font-semibold tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
        <h1 className="mt-2 text-[1.75rem] leading-[1.08] font-semibold tracking-tight whitespace-pre-line text-balance text-foreground sm:text-[2.35rem]">
          {title}
        </h1>
        <span className="mt-3 block h-1 w-12 rounded-full bg-primary" aria-hidden />
        {description ? (
          <p className="mt-3 max-w-xl text-sm leading-6 text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
