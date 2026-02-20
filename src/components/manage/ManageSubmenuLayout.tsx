"use client";

import type { ReactNode } from "react";

type SubmenuItem<T extends string> = {
  key: T;
  label: string;
  count?: number;
};

type ManageSubmenuLayoutProps<T extends string> = {
  items: Array<SubmenuItem<T>>;
  activeKey: T;
  onChange: (nextKey: T) => void;
  menuTitle: string;
  children: ReactNode;
};

export default function ManageSubmenuLayout<T extends string>({
  items,
  activeKey,
  onChange,
  menuTitle,
  children,
}: ManageSubmenuLayoutProps<T>) {
  return (
    <>
      <div className="tab-shell lg:hidden">
        <div className="tab-scroll">
          <nav className="tab-nav" aria-label={`${menuTitle} 탭`}>
            {items.map((item) => {
              const isActive = activeKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`tab-chip ${isActive ? "tab-chip-active" : ""}`}
                  onClick={() => onChange(item.key)}
                >
                  <span>{item.label}</span>
                  {typeof item.count === "number" ? (
                    <span
                      className={`ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                        isActive ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-600"
                      }`}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="surface-card p-2">
            <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
              {menuTitle}
            </p>
            <nav className="space-y-1" aria-label={`${menuTitle} 메뉴`}>
              {items.map((item) => {
                const isActive = activeKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-slate-900 text-white"
                        : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                    onClick={() => onChange(item.key)}
                  >
                    <span>{item.label}</span>
                    {typeof item.count === "number" ? (
                      <span
                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                          isActive ? "bg-white/20 text-white" : "bg-neutral-200 text-neutral-600"
                        }`}
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="space-y-5">{children}</div>
      </div>
    </>
  );
}
