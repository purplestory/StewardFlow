"use client";

import StatusFilterPills from "@/components/ui/StatusFilterPills";

type FilterOption<T extends string> = {
  value: T;
  label: string;
};

type ManageFilterToolbarProps<T extends string> = {
  totalCount: number;
  unitLabel?: string;
  onRefresh: () => void;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (next: string) => void;
  filterOptions: ReadonlyArray<FilterOption<T>>;
  filterValue: T;
  onFilterChange: (next: T) => void;
};

export default function ManageFilterToolbar<T extends string>({
  totalCount,
  unitLabel = "건",
  onRefresh,
  searchPlaceholder,
  query,
  onQueryChange,
  filterOptions,
  filterValue,
  onFilterChange,
}: ManageFilterToolbarProps<T>) {
  return (
    <div className="module-toolbar space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-600">
        <div className="flex flex-wrap items-center gap-2">
          <span className="module-kpi">
            총 {totalCount}
            {unitLabel}
          </span>
          <button type="button" onClick={onRefresh} className="btn-outline">
            새로고침
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="form-input text-sm md:w-72"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      </div>
      <StatusFilterPills
        options={filterOptions}
        value={filterValue}
        onChange={(next) => onFilterChange(next as T)}
      />
    </div>
  );
}
