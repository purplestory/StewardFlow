"use client";

import { Select, SelectItem, SelectTrigger } from "@/components/ui/select";

type BulkStatusOption<T extends string> = {
  value: T;
  label: string;
};

type ManageBulkStatusBarProps<T extends string> = {
  selectedCount: number;
  disabled?: boolean;
  options: ReadonlyArray<BulkStatusOption<T>>;
  onSelect: (status: T) => void;
  onClear: () => void;
};

export default function ManageBulkStatusBar<T extends string>({
  selectedCount,
  disabled = false,
  options,
  onSelect,
  onClear,
}: ManageBulkStatusBarProps<T>) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <div className="mt-3 list-row-muted flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium text-neutral-600">
        선택된 항목({selectedCount}건):
      </span>
      <Select
        value=""
        onValueChange={(next) => {
          if (next) {
            onSelect(next as T);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className="form-select h-9 text-xs">
          <SelectItem value="">일괄 상태 변경...</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              → {option.label}
            </SelectItem>
          ))}
        </SelectTrigger>
      </Select>
      <button type="button" onClick={onClear} className="btn-ghost text-xs">
        선택 해제
      </button>
    </div>
  );
}
