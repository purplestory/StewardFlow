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
    <div className={cx("surface-panel p-5 md:p-7", className)}>
      <div className="module-head">
        <div>
          <h1 className="module-title">{title}</h1>
          {description ? (
            <p className="module-description">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}
