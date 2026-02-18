"use client";

import type { ReactNode } from "react";

type PageHeroProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function PageHero({
  title,
  description,
  actions,
  children,
  className,
}: PageHeroProps) {
  return (
    <div className={cx("surface-panel p-4 md:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 text-sm text-neutral-600">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
