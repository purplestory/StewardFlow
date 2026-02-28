"use client";

import type { ReactNode } from "react";

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

type ModuleListProps = {
  className?: string;
  children: ReactNode;
};

export function ModuleList({ className, children }: ModuleListProps) {
  return <div className={cx("module-list", className)}>{children}</div>;
}

type ModuleListHeaderProps = {
  left: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function ModuleListHeader({ left, right, className }: ModuleListHeaderProps) {
  return (
    <div
      className={cx(
        "list-row-muted hidden items-center text-xs text-neutral-500 lg:grid",
        className
      )}
    >
      <span>{left}</span>
      {right ? <span className="text-right">{right}</span> : null}
    </div>
  );
}
