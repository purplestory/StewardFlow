"use client";

import type { ReactNode } from "react";

type SectionCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: SectionCardProps) {
  return (
    <section className={cx("surface-card", className)}>
      {title || description || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 px-6 py-4">
          <div>
            {title ? <h2 className="text-lg font-semibold text-slate-900">{title}</h2> : null}
            {description ? (
              <p className="mt-1 text-sm text-neutral-600">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cx("p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

