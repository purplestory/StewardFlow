"use client";

type StatusFilterOption<T extends string> = {
  value: T | "";
  label: string;
};

type StatusFilterPillsProps<T extends string> = {
  options: Array<StatusFilterOption<T>>;
  value: T | "";
  onChange: (next: T | "") => void;
  className?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export default function StatusFilterPills<T extends string>({
  options,
  value,
  onChange,
  className,
}: StatusFilterPillsProps<T>) {
  return (
    <div className={cx("flex flex-wrap items-center gap-2", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`filter-pill ${value === option.value ? "filter-pill-active" : ""}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

