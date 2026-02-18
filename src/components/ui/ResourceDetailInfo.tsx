"use client";

import type { ReactNode } from "react";

export type ResourceInfoItem = {
  label: string;
  value: ReactNode;
  hidden?: boolean;
  multiline?: boolean;
};

type ResourceInfoGridProps = {
  items: ResourceInfoItem[];
  className?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function ResourceInfoGrid({
  items,
  className,
}: ResourceInfoGridProps) {
  const visibleItems = items.filter((item) => !item.hidden);

  return (
    <div className={cx("space-y-2", className)}>
      {visibleItems.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-neutral-200 bg-neutral-50/70 px-3 py-2"
        >
          <div className="grid gap-1 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
            <span className="text-sm font-semibold text-neutral-700">{item.label}</span>
            <div
              className={cx(
                "min-w-0 break-words text-sm text-neutral-600",
                item.multiline && "whitespace-pre-wrap"
              )}
            >
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
