"use client";

import Link from "next/link";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbBarProps = {
  items: BreadcrumbItem[];
  className?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function BreadcrumbBar({ items, className }: BreadcrumbBarProps) {
  return (
    <nav aria-label="브레드크럼" className={cx("surface-panel px-4 py-3 md:px-5", className)}>
      <ol className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-sm text-neutral-500">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.href && !isLast ? (
                <Link href={item.href} className="hover:text-slate-900">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? "font-medium text-neutral-900" : undefined}>
                  {item.label}
                </span>
              )}
              {!isLast ? <span aria-hidden className="text-neutral-300">{">"}</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
