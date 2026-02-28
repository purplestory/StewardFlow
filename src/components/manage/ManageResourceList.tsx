"use client";

import type { ReactNode } from "react";

type ManageResourceListProps = {
  infoLabel: string;
  actionLabel?: string;
  allSelected: boolean;
  onToggleAll: () => void;
  children: ReactNode;
};

export default function ManageResourceList({
  infoLabel,
  actionLabel = "관리",
  allSelected,
  onToggleAll,
  children,
}: ManageResourceListProps) {
  return (
    <div className="module-list module-list-resources">
      <div className="list-row-muted hidden items-center text-xs text-neutral-500 lg:grid lg:grid-cols-[minmax(0,1fr)_8rem]">
        <span>{infoLabel}</span>
        <span className="text-right">{actionLabel}</span>
      </div>
      <div className="list-row-muted flex items-center gap-2 text-sm text-neutral-600">
        <input type="checkbox" checked={allSelected} onChange={onToggleAll} />
        <span>전체 선택</span>
      </div>
      {children}
    </div>
  );
}
