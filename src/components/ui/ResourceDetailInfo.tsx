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
    <div className={cx("overflow-hidden rounded-xl border border-neutral-200 bg-white", className)}>
      <dl className="divide-y divide-neutral-200">
        {visibleItems.map((item) => (
          <div key={item.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
            <dt className="text-sm font-semibold text-neutral-700">{item.label}</dt>
            <dd
              className={cx(
                "min-w-0 break-words text-sm text-neutral-600",
                item.multiline && "whitespace-pre-wrap"
              )}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
