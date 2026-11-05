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
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{eyebrow}</p>
        <h1 className="mt-2 text-[2rem] leading-[1.05] font-semibold whitespace-pre-line text-foreground sm:text-[2.7rem]">
          {title}
        </h1>
        <span className="mt-3 block h-1 w-12 rounded-full bg-primary" />
        {description ? (
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
